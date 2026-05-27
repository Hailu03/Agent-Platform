from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, joinedload

from app.models.base import get_db
from app.models.semantic import SemanticColumn, SemanticTable, SemanticRelationship, SemanticMetric, SemanticCalculationGroup
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.semantic import (
    ColumnRead,
    ColumnUpdate,
    RelationshipCreate,
    RelationshipRead,
    SchemaResponse,
    TableRead,
    TableUpdate,
    MetricRead,
    MetricCreate,
    MetricUpdate,
    CalculationGroupRead,
    CalculationGroupCreate
)

router = APIRouter(prefix="/semantic", tags=["semantic"])

@router.get("/{datasource_id}", response_model=SchemaResponse)
async def get_schema(
    datasource_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import logging
    logger = logging.getLogger(__name__)
    
    # 1. Fetch tables with columns using JOINED load for maximum reliability
    result = await db.execute(
        select(SemanticTable)
        .where(SemanticTable.datasource_id == datasource_id)
        .options(joinedload(SemanticTable.columns))
        .order_by(SemanticTable.name)
    )
    tables = result.unique().scalars().all()
    
    # Debug log
    for t in tables:
        logger.info(f"📊 Table: {t.name} | Columns found: {len(t.columns)}")

    # 2. Fetch relationships
    rels_result = await db.execute(
        select(SemanticRelationship).where(SemanticRelationship.datasource_id == datasource_id)
    )
    relationships = rels_result.scalars().all()

    # Fetch metrics
    metrics_result = await db.execute(
        select(SemanticMetric).where(SemanticMetric.datasource_id == datasource_id)
    )
    metrics = metrics_result.scalars().all()

    # Fetch calculation groups
    groups_result = await db.execute(
        select(SemanticCalculationGroup)
        .where(SemanticCalculationGroup.datasource_id == datasource_id)
        .options(selectinload(SemanticCalculationGroup.items))
    )
    groups = groups_result.scalars().all()

    return SchemaResponse(
        datasource_id=datasource_id,
        tables=[TableRead.model_validate(t) for t in tables],
        relationships=[RelationshipRead.model_validate(r) for r in relationships],
        metrics=[MetricRead.model_validate(m) for m in metrics],
        calculation_groups=[CalculationGroupRead.model_validate(g) for g in groups],
    )

@router.put("/tables/{table_id}", response_model=TableRead)
async def update_table(
    table_id: str,
    body: TableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SemanticTable)
        .where(SemanticTable.id == table_id)
        .options(selectinload(SemanticTable.columns))
    )
    tbl = result.scalar_one_or_none()
    if not tbl:
        raise HTTPException(status_code=404, detail="Table not found")

    if body.description is not None:
        tbl.description = body.description
    if body.pos_x is not None:
        tbl.pos_x = body.pos_x
    if body.pos_y is not None:
        tbl.pos_y = body.pos_y

    await db.commit()
    await db.refresh(tbl)
    return TableRead.model_validate(tbl)

@router.put("/columns/{column_id}", response_model=ColumnRead)
async def update_column(
    column_id: str,
    body: ColumnUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(SemanticColumn).where(SemanticColumn.id == column_id))
    col = result.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    col.description = body.description
    await db.commit()
    await db.refresh(col)
    return ColumnRead.model_validate(col)

@router.post("/metrics", response_model=MetricRead, status_code=status.HTTP_201_CREATED)
async def create_metric(
    body: MetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    metric = SemanticMetric(
        datasource_id=body.datasource_id,
        table_id=body.table_id,
        name=body.name,
        description=body.description,
        expression=body.expression,
        format_type=body.format_type,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return MetricRead.model_validate(metric)
