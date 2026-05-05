import time
import logging
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete

from app.models.base import get_db
from app.models.datasource import DataSource
from app.models.semantic import SemanticColumn, SemanticTable, SemanticRelationship
from app.core.security import get_current_user, encrypt_password, decrypt_password
from app.models.user import User
from app.schemas.connections import (
    ConnectionTestRequest,
    ConnectionTestResult,
    DataSourceCreate,
    DataSourceRead,
)
from app.schemas.semantic import TableRead, ColumnRead, RelationshipRead, SchemaResponse
from app.services.duckdb_service import DuckDBService
from app.services.powerbi_service import PowerBIService
from app.services.graph_rag_service import GraphRAGService

from app.repositories.datasource_repo import DataSourceRepository

router = APIRouter(prefix="/connections", tags=["connections"])
logger = logging.getLogger(__name__)

def get_datasource_repo(db: AsyncSession = Depends(get_db)) -> DataSourceRepository:
    return DataSourceRepository(db)

# --- Helper to test connection ---
async def perform_test(body: ConnectionTestRequest) -> ConnectionTestResult:
    t0 = time.monotonic()
    try:
        ds_dict = body.model_dump()
        ds_dict["plain_password"] = body.plain_password
        
        if body.engine.lower() == "powerbi":
            tenant_id = body.host
            client_id = body.username
            client_secret = body.plain_password
            await PowerBIService.get_access_token(tenant_id, client_id, client_secret)
        else:
            # Use DuckDB to test SQL connections
            with DuckDBService.execution_context([ds_dict]) as conn:
                conn.execute("SELECT 1")
            
        latency = round((time.monotonic() - t0) * 1000, 1)
        return ConnectionTestResult(success=True, latency_ms=latency)
    except Exception as exc:
        return ConnectionTestResult(success=False, error=str(exc))

@router.post("/test", response_model=ConnectionTestResult)
async def test_connection(
    body: ConnectionTestRequest,
    current_user: User = Depends(get_current_user),
):
    return await perform_test(body)

@router.get("", response_model=list[DataSourceRead])
async def list_connections(
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    items = await repo.list_all()
    return [DataSourceRead.model_validate(ds) for ds in items]

@router.post("", response_model=DataSourceRead, status_code=status.HTTP_201_CREATED)
async def save_connection(
    body: DataSourceCreate,
    db: AsyncSession = Depends(get_db),
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    ds = DataSource(
        name=body.name,
        engine=body.engine,
        host=body.host,
        port=body.port,
        database=body.database,
        schema_name=body.schema_name,
        username=body.username,
        encrypted_password=encrypt_password(body.plain_password),
        extra_params=body.extra_params,
        ssl=body.ssl,
        instructions=body.instructions,
        sql_samples=body.sql_samples
    )
    db.add(ds)
    await db.commit()
    await db.refresh(ds)
    
    # Kích hoạt Indexing qua Celery
    try:
        from app.tasks.graph_rag import index_datasource_task
        task = index_datasource_task.delay(ds.id)
        ds.task_id = task.id
        await db.commit()
    except Exception as e:
        logger.error(f"⚠️ Không thể kích hoạt Celery task: {e}")
        
    return DataSourceRead.model_validate(ds)

@router.put("/{ds_id}", response_model=DataSourceRead)
async def update_connection(
    ds_id: str,
    body: DataSourceCreate,
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    ds = await repo.get_by_id(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    ds.name = body.name
    ds.engine = body.engine
    ds.host = body.host
    ds.port = body.port
    ds.database = body.database
    ds.schema_name = body.schema_name
    ds.username = body.username
    if body.plain_password:
        ds.encrypted_password = encrypt_password(body.plain_password)
    ds.extra_params = body.extra_params
    ds.ssl = body.ssl
    ds.instructions = body.instructions
    ds.sql_samples = body.sql_samples

    await repo.db.commit()
    await repo.db.refresh(ds)

    # Kích hoạt lại Indexing qua Celery
    try:
        from app.tasks.graph_rag import index_datasource_task
        task = index_datasource_task.delay(ds.id)
        ds.task_id = task.id
        await repo.db.commit()
    except Exception as e:
        logger.error(f"⚠️ Không thể kích hoạt Celery task: {e}")

    return DataSourceRead.model_validate(ds)

@router.delete("/{ds_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    ds_id: str,
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    ds = await repo.get_by_id(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # 1. Kích hoạt dọn dẹp tri thức trong GraphRAG (Neo4J & Qdrant)
    try:
        from app.tasks.graph_rag import delete_datasource_task
        agent_id = ds.extra_params.get("agent_id") if ds.extra_params else None
        delete_datasource_task.delay(ds_id, agent_id)
    except Exception as e:
        logger.error(f"⚠️ Không thể kích hoạt dọn dẹp GraphRAG: {e}")

    # 2. Xóa trong SQL DB (bao gồm cả semantic metadata)
    await repo.delete(ds_id)

@router.post("/{ds_id}/introspect")
async def introspect_schema(
    ds_id: str,
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    ds = await repo.get_by_id(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # 2. Kích hoạt Indexing qua Celery
    try:
        from app.tasks.graph_rag import index_datasource_task
        task = index_datasource_task.delay(ds.id)
        ds.task_id = task.id
        await repo.db.commit()
    except Exception as e:
        logger.error(f"⚠️ Không thể kích hoạt Celery task: {e}")
        raise HTTPException(status_code=500, detail="Không thể khởi động Celery Task")

    return {"message": "Đã đưa yêu cầu làm mới cấu trúc vào hàng đợi.", "task_id": task.id}

@router.post("/{ds_id}/test", response_model=ConnectionTestResult)
async def test_existing_connection(
    ds_id: str,
    repo: DataSourceRepository = Depends(get_datasource_repo),
    current_user: User = Depends(get_current_user),
):
    ds = await repo.get_by_id(ds_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Chuyển đổi sang request body để tái sử dụng hàm perform_test
    test_req = ConnectionTestRequest(
        name=ds.name,
        engine=ds.engine,
        host=ds.host,
        port=ds.port,
        database=ds.database,
        schema_name=ds.schema_name or "public",
        username=ds.username,
        plain_password=decrypt_password(ds.encrypted_password),
        ssl=ds.ssl or False
    )
    
    return await perform_test(test_req)
