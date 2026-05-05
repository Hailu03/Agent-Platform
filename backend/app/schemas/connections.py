from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Any

class ConnectionTestRequest(BaseModel):
    name: str = ""
    engine: str
    host: str
    port: int
    database: str
    schema_name: str = "public"
    username: str
    plain_password: str
    extra_params: Optional[dict] = None
    ssl: bool = False

class ConnectionTestResult(BaseModel):
    success: bool
    latency_ms: Optional[float] = None
    error: Optional[str] = None

class DataSourceBase(BaseModel):
    name: str
    engine: str
    host: str
    port: int
    database: str
    schema_name: str = "public"
    username: str
    extra_params: Optional[dict] = None
    ssl: bool = False
    instructions: Optional[str] = None
    sql_samples: Optional[List[dict]] = None

class DataSourceCreate(DataSourceBase):
    plain_password: str

class DataSourceRead(DataSourceBase):
    id: str
    status: str
    task_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
