import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class DataSource(Base):
    __tablename__ = "datasources"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    engine: Mapped[str] = mapped_column(String(32), nullable=False)  # postgres, mysql, snowflake, etc.
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    database: Mapped[str] = mapped_column(String(128), nullable=False)
    schema_name: Mapped[str] = mapped_column(String(128), nullable=False, default="public")
    username: Mapped[str] = mapped_column(String(128), nullable=False)
    encrypted_password: Mapped[str] = mapped_column(String(512), nullable=False)
    extra_params: Mapped[dict] = mapped_column(JSON, nullable=True)
    ssl: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="connected")
    instructions: Mapped[str] = mapped_column(String, nullable=True)
    sql_samples: Mapped[list] = mapped_column(JSON, nullable=True)
    task_id: Mapped[str] = mapped_column(String(64), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    tables: Mapped[list["SemanticTable"]] = relationship(
        "SemanticTable", back_populates="datasource", cascade="all, delete-orphan"
    )
