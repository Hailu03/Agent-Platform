import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from app.models.base import Base


class FacebookContact(Base):
    __tablename__ = "facebook_contacts"
    __table_args__ = (
        UniqueConstraint("user_id", "page_id", "provider_user_id", name="uq_facebook_contact_provider_user"),
    )

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    provider_user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True, index=True)
    normalized_name = Column(String, nullable=True, index=True)
    profile_pic = Column(String, nullable=True)
    source = Column(String, nullable=False, default="unknown")
    last_interaction_at = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FacebookConversation(Base):
    __tablename__ = "facebook_conversations"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    conversation_id = Column(String, nullable=False, index=True)
    participant_id = Column(String, nullable=True, index=True)
    participant_name = Column(String, nullable=True)
    status = Column(String, nullable=False, default="open")
    last_message = Column(Text, nullable=True)
    updated_time = Column(DateTime(timezone=True), nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FacebookPost(Base):
    __tablename__ = "facebook_posts"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    post_id = Column(String, nullable=False, index=True)
    message = Column(Text, nullable=True)
    created_time = Column(DateTime(timezone=True), nullable=True)
    shares_count = Column(Integer, nullable=False, default=0)
    reactions_count = Column(Integer, nullable=False, default=0)
    comments_count = Column(Integer, nullable=False, default=0)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FacebookComment(Base):
    __tablename__ = "facebook_comments"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    post_id = Column(String, nullable=True, index=True)
    comment_id = Column(String, nullable=False, index=True)
    parent_id = Column(String, nullable=True, index=True)
    author_id = Column(String, nullable=True, index=True)
    author_name = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    created_time = Column(DateTime(timezone=True), nullable=True)
    can_reply = Column(Boolean, nullable=False, default=True)
    is_hidden = Column(Boolean, nullable=False, default=False)
    has_replied = Column(Boolean, nullable=False, default=False)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FacebookInsightSnapshot(Base):
    __tablename__ = "facebook_insight_snapshots"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    page_id = Column(String, nullable=False, index=True)
    metric = Column(String, nullable=False, index=True)
    period = Column(String, nullable=True)
    end_time = Column(DateTime(timezone=True), nullable=True)
    value = Column(JSON, nullable=True)
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True, index=True)
    thread_id = Column(String, nullable=True, index=True)
    provider = Column(String, nullable=False, default="unknown")
    tool = Column(String, nullable=False, default="unknown")
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MetaWebhookEvent(Base):
    __tablename__ = "meta_webhook_events"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, nullable=False, default="meta")
    object_type = Column(String, nullable=True, index=True)
    page_id = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=True, index=True)
    normalized_payload = Column(JSON, nullable=True)
    raw_payload = Column(JSON, nullable=False)
    signature_valid = Column(Boolean, nullable=False, default=False)
    processed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
