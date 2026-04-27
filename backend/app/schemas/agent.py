from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class AgentBase(BaseModel):
    name: str
    description: Optional[str] = None
    specialty: Optional[str] = None
    model_provider: str = "openai" # openai, anthropic, google, ollama
    model_name: str = "gpt-4o"
    api_key: Optional[str] = None
    
    # Embedding Configuration
    embedding_provider: str = "google"
    embedding_model: str = "models/embedding-001"
    embedding_api_key: Optional[str] = None
    
    instructions: Optional[str] = None
    tools: List[Any] = [] # Can be string or {"name": str, "is_active": bool}
    skills: List[Any] = []
    sub_agents: List[str] = []
    workflow_id: Optional[str] = None
    triggers: List[dict] = []
    knowledge_files: Optional[List[Any]] = []
    is_active: bool = True

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    specialty: Optional[str] = None
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    
    # Embedding Configuration
    embedding_provider: Optional[str] = None
    embedding_model: Optional[str] = None
    embedding_api_key: Optional[str] = None
    
    instructions: Optional[str] = None
    tools: Optional[List[Any]] = None
    skills: Optional[List[Any]] = None
    sub_agents: Optional[List[str]] = None
    workflow_id: Optional[str] = None
    triggers: Optional[List[dict]] = None
    knowledge_files: Optional[List[Any]] = None
    is_active: Optional[bool] = None

class AgentResponse(AgentBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
