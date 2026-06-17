from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    graph: Dict[str, Any] = {"nodes": [], "edges": []}
    is_active: bool = True
    is_scheduled: bool = False
    cron_expression: Optional[str] = None

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_scheduled: Optional[bool] = None
    cron_expression: Optional[str] = None

class WorkflowResponse(WorkflowBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowRunRequest(BaseModel):
    user_query: Optional[str] = "Test query"
    agent_id: Optional[str] = None
    inputs: Optional[Dict[str, Any]] = {}
