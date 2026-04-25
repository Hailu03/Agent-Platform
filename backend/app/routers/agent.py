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
        content = await file.read()
        file_ext = os.path.splitext(file.filename)[1]
        object_name = f"{current_user.id}/{uuid.uuid4()}{file_ext}"
        
        file_url = storage_service.upload_file(content, object_name)
        
        return {
            "filename": file.filename,
            "object_name": object_name,
            "url": file_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải file: {str(e)}")
