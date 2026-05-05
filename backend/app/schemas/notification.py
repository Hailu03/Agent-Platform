from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.models.notification import NotificationType

class NotificationBase(BaseModel):
    type: NotificationType
    title: str
    message: str
    link: Optional[str] = None
    data: Optional[dict] = None

class NotificationCreate(NotificationBase):
    user_id: str

class NotificationResponse(NotificationBase):
    id: str
    created_at: datetime
    is_read: bool = False

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    unread_count: int
    next_cursor: Optional[str] = None
