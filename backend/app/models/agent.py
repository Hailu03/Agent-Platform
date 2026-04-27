from sqlalchemy import Column, String, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from app.models.base import Base

class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    specialty = Column(String, nullable=True) # support, sales, research, marketing, etc.
    
    # Model Configuration
    model_provider = Column(String, default="openai") # openai, anthropic, ollama, etc.
    model_name = Column(String, default="gpt-4o")
    api_key = Column(String, nullable=True) # Optional: Direct API key (will be encrypted later)
    api_key_id = Column(String, nullable=True) # Reference to stored credentials
    
    # Embedding Configuration
    embedding_provider = Column(String, default="google") # openai, google, ollama
    embedding_model = Column(String, default="models/embedding-001")
    embedding_api_key = Column(String, nullable=True)
    
    # Core Logic
    instructions = Column(Text, nullable=True)
    
    # Components (Stored as JSON for flexibility, can be moved to relational tables later)
    tools = Column(JSON, default=list) # List of tool IDs or definitions
    skills = Column(JSON, default=list) # List of skill IDs
    sub_agents = Column(JSON, default=list) # Multi-agent collaboration
    knowledge_files = Column(JSON, default=list) # List of file paths in MinIO
    
    # Orchestration
    workflow_id = Column(String, nullable=True)
    
    # Automation
    triggers = Column(JSON, default=list) # List of cron schedules or event triggers
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
