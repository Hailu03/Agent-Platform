from pydantic import BaseModel
from typing import List, Optional, Literal
from datetime import datetime

class GuardrailsBase(BaseModel):
    enabled: bool = False
    action: Literal["warn", "block"] = "warn"
    policy_text: Optional[str] = ""
    prohibited_terms: List[str] = []
    required_phrases: List[str] = []
    max_output_chars: Optional[int] = None
    input_action: Literal["warn", "block"] = "warn"
    input_prohibited_terms: List[str] = []
    input_required_phrases: List[str] = []
    max_input_chars: Optional[int] = None

class GuardrailsUpdate(BaseModel):
    enabled: Optional[bool] = None
    action: Optional[Literal["warn", "block"]] = None
    policy_text: Optional[str] = None
    prohibited_terms: Optional[List[str]] = None
    required_phrases: Optional[List[str]] = None
    max_output_chars: Optional[int] = None
    input_action: Optional[Literal["warn", "block"]] = None
    input_prohibited_terms: Optional[List[str]] = None
    input_required_phrases: Optional[List[str]] = None
    max_input_chars: Optional[int] = None

class GuardrailsResponse(GuardrailsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
