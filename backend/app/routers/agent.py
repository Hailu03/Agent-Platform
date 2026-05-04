from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.models.base import get_db
from app.models.user import User
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate, AgentResponse
from app.core.security import get_current_user
from app.core.storage import storage_service
import os

from app.repositories.agent_repo import AgentRepository
from app.services.agent_service import AgentService
from app.agents.tools.registry import get_available_tools
from app.tasks.graph_rag import process_document_task
from app.celery_worker import celery_app
from celery.result import AsyncResult
from pydantic import BaseModel

from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/agents", tags=["Agents"])

def get_agent_service(db: AsyncSession = Depends(get_db)) -> AgentService:
    repo = AgentRepository(db)
    return AgentService(repo)

@router.post("/", response_model=AgentResponse)
async def create_agent(
    agent_in: AgentCreate,
    service: AgentService = Depends(get_agent_service),
    current_user: User = Depends(get_current_user)
):
    return await service.create_agent(agent_in, current_user.id)

@router.get("/", response_model=List[AgentResponse])
async def list_agents(
    service: AgentService = Depends(get_agent_service),
    current_user: User = Depends(get_current_user)
):
    return await service.list_agents(current_user.id)

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    service: AgentService = Depends(get_agent_service),
    current_user: User = Depends(get_current_user)
):
    agent = await service.get_agent(agent_id, current_user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Không tìm thấy Agent")
    return agent

@router.patch("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    agent_in: AgentUpdate,
    service: AgentService = Depends(get_agent_service),
    current_user: User = Depends(get_current_user)
):
    agent = await service.update_agent(agent_id, agent_in, current_user.id)
    if not agent:
        raise HTTPException(status_code=404, detail="Không tìm thấy Agent")
    return agent
    
@router.post("/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        content_bytes = await file.read()
        file_ext = os.path.splitext(file.filename)[1].lower()
        object_name = f"{current_user.id}/{uuid.uuid4()}{file_ext}"
        
        # 1. Lưu file lên MinIO như cũ
        file_url = storage_service.upload_file(content_bytes, object_name)
        
        # 2. Trả về thông tin file để Frontend lưu vào danh sách knowledge_files của Agent
        return {
            "filename": file.filename,
            "object_name": object_name,
            "url": file_url
        }
    except Exception as e:
        logger.error(f"❌ Lỗi khi tải file lên: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống: {str(e)}")

class IndexRequest(BaseModel):
    file_url: str
    filename: str
    provider: str
    model_name: str
    api_key: str = None
    embedding_provider: str = "google"
    embedding_model: str = "models/embedding-001"
    embedding_api_key: str = None
    agent_id: str = "temp"

@router.post("/index")
async def trigger_indexing(
    req: IndexRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Kích hoạt indexing cho một tài liệu cụ thể.
    """
    task = process_document_task.delay(
        file_url=req.file_url,
        provider=req.provider,
        model_name=req.model_name,
        api_key=req.api_key,
        metadata={"filename": req.filename, "agent_id": req.agent_id},
        embedding_provider=req.embedding_provider,
        embedding_model=req.embedding_model,
        embedding_api_key=req.embedding_api_key
    )
    return {"task_id": task.id, "status": "pending"}

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    """
    Lấy trạng thái của một Celery task.
    """
    result = AsyncResult(task_id, app=celery_app)
    return {
        "task_id": task_id,
        "status": result.status, # PENDING, STARTED, SUCCESS, FAILURE, etc.
        "result": str(result.result) if result.ready() else None
    }

@router.get("/tools/available")
async def list_available_tools(current_user: User = Depends(get_current_user)):
    """
    Trả về danh sách các công cụ (tools) mà hệ thống hỗ trợ.
    """
    return get_available_tools()
