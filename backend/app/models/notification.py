from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.sql import func
import enum
from app.models.base import Base

class NotificationType(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), index=True, nullable=False)
    type = Column(String, default=NotificationType.INFO)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    link = Column(String, nullable=True) # Optional link to go to
    data = Column(JSON, nullable=True) # Extra metadata
    is_read = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
