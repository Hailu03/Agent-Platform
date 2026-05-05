from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class ColumnRead(BaseModel):
    id: str
    name: str
    data_type: str
    description: str
    is_primary_key: bool
    is_nullable: bool
    model_config = ConfigDict(from_attributes=True)

class ColumnUpdate(BaseModel):
    description: str

class RelationshipRead(BaseModel):
    id: str
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    relation_type: Optional[str] = "Many-to-one"
    description: Optional[str] = ""
    model_config = ConfigDict(from_attributes=True)

class RelationshipCreate(BaseModel):
    datasource_id: str
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    relation_type: str = "Many-to-one"
    description: str = ""

class RelationshipUpdate(BaseModel):
    relation_type: Optional[str] = None
    description: Optional[str] = None

class TableRead(BaseModel):
    id: str
    name: str
    description: str
    pos_x: float
    pos_y: float
    columns: List[ColumnRead] = []
    model_config = ConfigDict(from_attributes=True)

class TableUpdate(BaseModel):
    description: Optional[str] = None
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None

class MetricRead(BaseModel):
    id: str
    datasource_id: str
    table_id: Optional[str] = None
    name: str
    description: str
    expression: str
    format_type: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class MetricCreate(BaseModel):
    datasource_id: str
    table_id: Optional[str] = None
    name: str
    description: str = ""
    expression: str
    format_type: str = "Number"

class MetricUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    expression: Optional[str] = None
    format_type: Optional[str] = None

class CalculationItemRead(BaseModel):
    id: str
    group_id: str
    name: str
    description: str
    expression: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CalculationItemCreate(BaseModel):
    name: str
    description: str = ""
    expression: str

class CalculationGroupRead(BaseModel):
    id: str
    datasource_id: str
    name: str
    description: str
    items: List[CalculationItemRead] = []
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CalculationGroupCreate(BaseModel):
    datasource_id: str
    name: str
    description: str = ""

class CalculationGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class SchemaResponse(BaseModel):
    datasource_id: str
    tables: List[TableRead]
    relationships: List[RelationshipRead]
    metrics: List[MetricRead] = []
    calculation_groups: List[CalculationGroupRead] = []

class DataPreviewResponse(BaseModel):
    columns: List[str]
    rows: List[dict]
