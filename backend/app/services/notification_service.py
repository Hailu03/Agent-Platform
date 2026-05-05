import json
import uuid
from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, desc, func
from datetime import datetime

from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.schemas.notification import NotificationCreate, NotificationResponse
from app.core.redis import async_redis_client
from app.core.logging import get_logger

logger = get_logger(__name__)

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.redis = async_redis_client

    async def create_notification(
        self, 
        user_id: str, 
        type: NotificationType, 
        title: str, 
        message: str, 
        link: Optional[str] = None,
        data: Optional[dict] = None
    ) -> Notification:
        """Tạo thông báo mới, lưu vào DB và push qua Redis Pub/Sub."""
        db_notification = Notification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            link=link,
            data=data
        )
        self.db.add(db_notification)
        await self.db.commit()
        await self.db.refresh(db_notification)

        # Push tới Redis Pub/Sub để đẩy real-time qua SSE
        notification_data = {
            "id": db_notification.id,
            "type": db_notification.type,
            "title": db_notification.title,
            "message": db_notification.message,
            "link": db_notification.link,
            "created_at": db_notification.created_at.isoformat() if db_notification.created_at else None,
            "is_read": False
        }
        
        # Channel name format: user_notifications:{user_id}
        channel = f"user_notifications:{user_id}"
        await self.redis.publish(channel, json.dumps(notification_data))
        
        return db_notification

    async def get_notifications(
        self, 
        user_id: str, 
        cursor: Optional[str] = None, 
        limit: int = 20,
        type: Optional[NotificationType] = None,
        unread_only: bool = False
    ) -> dict:
        """Lấy danh sách thông báo với cursor-based pagination, bộ lọc và đếm số chưa đọc."""
        
        # 1. Lấy timestamp lần cuối user nhấn "Mark all as read"
        result = await self.db.execute(select(User.last_notifications_read_at).where(User.id == user_id))
        last_read_at = result.scalar() or datetime.min

        # 2. Query thông báo
        query = select(Notification).where(Notification.user_id == user_id)
        
        if cursor:
            # Lấy thông báo cũ hơn cursor (Timestamp)
            cursor_dt = datetime.fromisoformat(cursor)
            query = query.where(Notification.created_at < cursor_dt)
        
        if type:
            query = query.where(Notification.type == type)
            
        if unread_only:
            query = query.where(Notification.created_at > last_read_at)
        
        query = query.order_by(desc(Notification.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        items = result.scalars().all()

        # 3. Đếm số chưa đọc (Dựa vào last_read_at thay vì flag is_read từng dòng)
        count_query = select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.created_at > last_read_at
        )
        unread_result = await self.db.execute(count_query)
        unread_count = unread_result.scalar() or 0

        # 4. Format response
        notifications = []
        for item in items:
            notif = NotificationResponse.model_validate(item)
            # Logic Hybrid: Nếu (created_at <= last_read_at) HOẶC (item.is_read == True) thì coi là ĐÃ ĐỌC
            notif.is_read = (item.is_read) or (item.created_at <= last_read_at if item.created_at and last_read_at else False)
            notifications.append(notif)

        next_cursor = items[-1].created_at.isoformat() if items else None
        
        return {
            "items": notifications,
            "unread_count": unread_count,
            "next_cursor": next_cursor
        }

    async def mark_all_as_read(self, user_id: str):
        """Cập nhật timestamp last_read_at của User. Cực kỳ nhanh và hiệu quả."""
        now = datetime.now()
        await self.db.execute(
            update(User).where(User.id == user_id).values(last_notifications_read_at=now)
        )
        await self.db.commit()
        return {"success": True, "last_read_at": now.isoformat()}

    async def mark_as_read(self, notification_id: str, user_id: str):
        """Đánh dấu một thông báo cụ thể là đã đọc."""
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
        await self.db.commit()
        return {"success": True}

    async def delete_notification(self, notification_id: str, user_id: str):
        """Xóa một thông báo cụ thể."""
        from sqlalchemy import delete
        await self.db.execute(
            delete(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        await self.db.commit()
        return {"success": True}
