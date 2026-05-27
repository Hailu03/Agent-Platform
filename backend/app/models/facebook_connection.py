from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func

from app.models.base import Base


class FacebookConnection(Base):
    __tablename__ = "facebook_connections"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, unique=True, index=True)

    facebook_user_id = Column(String, nullable=True, index=True)
    facebook_user_name = Column(String, nullable=True)

    long_lived_user_token = Column(String, nullable=True)
    user_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    scopes = Column(JSON, default=list)
    pages = Column(JSON, default=list)

    selected_page_id = Column(String, nullable=True)
    selected_page_name = Column(String, nullable=True)
    selected_page_access_token = Column(String, nullable=True)

    graph_version = Column(String, nullable=True)
    token_health = Column(JSON, nullable=True)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, nullable=False, default="active")
    last_token_check_at = Column(DateTime(timezone=True), nullable=True)
    last_successful_api_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
