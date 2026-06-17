from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base

class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False, index=True)
    url = Column(String, nullable=False)  # Remote SSE/HTTP endpoint
    auth_type = Column(String, default="none")  # none, api_key, bearer_token, custom
    auth_config = Column(JSON, default=dict)  # Stores credentials, e.g., headers or parameters
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
