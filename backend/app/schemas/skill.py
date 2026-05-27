import json
from pydantic import BaseModel, field_validator
from typing import Optional, Any
from datetime import datetime

class SkillBase(BaseModel):
    name: str
    description: Optional[str] = None
    content: str
    is_template: bool = False
    required_tools: Optional[list[str]] = None

class SkillCreate(SkillBase):
    pass

class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    is_template: Optional[bool] = None

class SkillResponse(SkillBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    @field_validator("required_tools", mode="before")
    @classmethod
    def _coerce_required_tools(cls, value: Any):
        # Backward/bug compatibility: some rows may store JSON as string.
        if value is None:
            return None
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, list) else None
            except Exception:
                return None
        return None

    class Config:
        from_attributes = True
