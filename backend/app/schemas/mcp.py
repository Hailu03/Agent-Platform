from pydantic import BaseModel, HttpUrl
from typing import Optional, Dict, Any, List
from datetime import datetime

class MCPServerBase(BaseModel):
    name: str
    url: str  # Remote SSE/HTTP endpoint
    auth_type: str = "none"  # none, api_key, bearer_token, custom
    auth_config: Dict[str, Any] = {}
    is_active: bool = True

class MCPServerCreate(MCPServerBase):
    pass

class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    auth_type: Optional[str] = None
    auth_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class MCPServerResponse(MCPServerBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MCPTestConnectionRequest(BaseModel):
    url: str
    auth_type: str = "none"
    auth_config: Dict[str, Any] = {}
