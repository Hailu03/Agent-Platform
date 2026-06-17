from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from app.models.base import Base

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    
    # Sơ đồ đồ thị: {"nodes": [...], "edges": [...]}
    graph = Column(JSON, nullable=False, default=dict)
    
    # Lập lịch tự động chạy
    cron_expression = Column(String, nullable=True)
    is_scheduled = Column(Boolean, default=False)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
