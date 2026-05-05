import json
import asyncio
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.models.base import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.notification_service import NotificationService
from app.schemas.notification import NotificationListResponse
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])

def get_notification_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(db)

@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    cursor: Optional[str] = None,
    limit: int = 20,
    type: Optional[str] = None,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Lấy danh sách thông báo với phân trang cursor và bộ lọc."""
    return await service.get_notifications(current_user.id, cursor, limit, type, unread_only)

@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Đánh dấu tất cả thông báo là đã đọc (Update timestamp)."""
    return await service.mark_all_as_read(current_user.id)

@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Đánh dấu một thông báo cụ thể là đã đọc."""
    return await service.mark_as_read(notification_id, current_user.id)

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """Xóa một thông báo."""
    return await service.delete_notification(notification_id, current_user.id)

@router.get("/stream")
async def notification_stream(
    request: Request,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service)
):
    """
    Endpoint SSE để nhận thông báo real-time.
    Sử dụng Redis Pub/Sub để lắng nghe thông báo mới cho user cụ thể.
    """
    user_id = current_user.id
    channel = f"user_notifications:{user_id}"

    async def event_generator():
        # Tạo Pub/Sub listener
        pubsub = service.redis.pubsub()
        await pubsub.subscribe(channel)
        
        logger.info(f"🔔 User {user_id} đã kết nối tới luồng thông báo (SSE)")
        
        try:
            while True:
                # Kiểm tra nếu client ngắt kết nối
                if await request.is_disconnected():
                    logger.info(f"📴 User {user_id} đã ngắt kết nối thông báo")
                    break

                # Đọc message từ Redis (non-blocking)
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data}\n\n"
                
                # Keep-alive ping mỗi 30s
                await asyncio.sleep(0.1)
                
        except Exception as e:
            logger.error(f"❌ Lỗi luồng thông báo cho User {user_id}: {e}")
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
