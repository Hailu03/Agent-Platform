from datetime import datetime, timezone
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


ArtifactType = Literal["chart", "table", "metric_grid", "timeline", "entity_list"]
ArtifactRenderer = Literal["line", "bar", "area", "pie", "table", "metric_grid", "timeline"]


class AgentArtifactSource(BaseModel):
    provider: str
    tool: str
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AgentArtifactDisplay(BaseModel):
    renderer: ArtifactRenderer
    x: Optional[str] = None
    y: Optional[str | list[str]] = None
    series: Optional[str] = None
    unit: Optional[str] = None


class AgentArtifact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: ArtifactType
    title: str
    description: Optional[str] = None
    source: AgentArtifactSource
    data: Any
    display: AgentArtifactDisplay


def artifact_envelope(*artifacts: AgentArtifact, message: str = "") -> str:
    payload = {
        "success": True,
        "message": message,
        "artifacts": [artifact.model_dump() for artifact in artifacts],
    }
    import json

    return json.dumps(payload, ensure_ascii=False)
