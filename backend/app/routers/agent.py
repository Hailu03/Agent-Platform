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

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    service: AgentService = Depends(get_agent_service),
    current_user: User = Depends(get_current_user)
):
    success = await service.delete_agent(agent_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy Agent để xóa")
    return None
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Kích hoạt indexing cho một tài liệu cụ thể.
    """
    api_key = req.api_key
    emb_api_key = req.embedding_api_key
    
    def is_masked(val):
        return val in ["********", "****"] or (val and "****" in str(val))

    agent_name = "temp"
    if req.agent_id != "temp":
        from app.models.agent import Agent
        result = await db.execute(select(Agent).where(Agent.id == req.agent_id))
        agent = result.scalar_one_or_none()
        if agent:
            agent_name = agent.name
            from app.core.security import decrypt_password
            if is_masked(api_key):
                api_key = decrypt_password(agent.api_key) if agent.api_key else None
            if is_masked(emb_api_key):
                emb_api_key = decrypt_password(agent.embedding_api_key) if agent.embedding_api_key else None

    task = process_document_task.delay(
        file_url=req.file_url,
        provider=req.provider,
        model_name=req.model_name,
        api_key=api_key,
        metadata={"filename": req.filename, "agent_id": req.agent_id, "agent_name": agent_name},
        embedding_provider=req.embedding_provider,
        embedding_model=req.embedding_model,
        embedding_api_key=emb_api_key
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

import os
import mimetypes

@router.get("/knowledge/presigned-url")
async def get_knowledge_presigned_url(
    object_name: str,
    disposition: str = "inline",
    current_user: User = Depends(get_current_user)
):
    """
    Tạo presigned URL để xem/tải tài liệu từ MinIO.
    """
    if not object_name.startswith(f"{current_user.id}/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập vào tài liệu này."
        )
    try:
        content_type, _ = mimetypes.guess_type(object_name)
        # Nếu là download, ép Content-Disposition thành attachment
        final_disposition = disposition
        if disposition == "attachment":
            filename = os.path.basename(object_name)
            final_disposition = f"attachment; filename={filename}"
            
        url = storage_service.get_presigned_url(object_name, response_type=content_type, disposition=final_disposition)
        if not url:
            raise HTTPException(status_code=404, detail="Không thể tạo URL cho tài liệu này")
        return {"url": url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Lỗi khi tạo presigned URL: {str(e)}")
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi truy cập kho lưu trữ")

from app.services.blueprint_service import BlueprintService

from typing import Optional

class CompileBlueprintRequest(BaseModel):
    query: str
    access: Optional[List[str]] = None
    autonomy: Optional[str] = None
    schedule: Optional[str] = None
    current_tools: Optional[List[str]] = None
    current_skills: Optional[List[str]] = None
    current_instructions: Optional[str] = None

@router.post("/blueprint/compile")
async def compile_agent_blueprint(
    req: CompileBlueprintRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Biên dịch mô tả ngôn ngữ tự nhiên thành một cấu hình AI Agent Blueprint.
    """
    try:
        blueprint = BlueprintService.compile_blueprint(
            query=req.query,
            access=req.access,
            autonomy=req.autonomy,
            schedule=req.schedule,
            current_tools=req.current_tools,
            current_skills=req.current_skills,
            current_instructions=req.current_instructions
        )
        return {"success": True, "blueprint": blueprint}
    except Exception as e:
        logger.error(f"❌ Lỗi biên dịch blueprint: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi hệ thống khi biên dịch cấu hình AI: {str(e)}"
        )
