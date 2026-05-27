from sqlalchemy import Column, String, Boolean, DateTime, JSON, Text, Integer
from sqlalchemy.sql import func
from app.models.base import Base

class SystemGuardrails(Base):
    __tablename__ = "system_guardrails"

    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Boolean, default=False)
    action = Column(String, default="warn")
    policy_text = Column(Text, default="")
    prohibited_terms = Column(JSON, default=list)
    required_phrases = Column(JSON, default=list)
    max_output_chars = Column(Integer, nullable=True)
    input_action = Column(String, default="warn")
    input_prohibited_terms = Column(JSON, default=list)
    input_required_phrases = Column(JSON, default=list)
    max_input_chars = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
