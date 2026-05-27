import uuid
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from app.models.base import Base


class GoogleToolConnection(Base):
    __tablename__ = "google_tool_connections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, unique=True, index=True, nullable=False)
    google_account_id = Column(String, index=True, nullable=True)
    google_account_email = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expiry = Column(DateTime(timezone=True), nullable=True)
    scopes = Column(JSON, nullable=True)
    status = Column(String(32), nullable=False, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
