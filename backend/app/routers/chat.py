from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.base import get_db
from app.core.security import get_current_user
from app.models.user import User
from pydantic import BaseModel
from typing import List, Dict, Optional

from app.repositories.agent_repo import AgentRepository
from app.services.chat_service import ChatService
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Chat"], redirect_slashes=False)

def get_chat_service(db: AsyncSession = Depends(get_db)) -> ChatService:
    repo = AgentRepository(db)
    return ChatService(repo)

class ChatRequest(BaseModel):
    agent_id: str
    message: str
    thread_id: Optional[str] = None
    history: List[Dict[str, str]] = []
    command: Optional[Dict] = None

@router.post("/")
async def chat(
    request: ChatRequest,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"💬 Nhận yêu cầu chat (Sync) từ User {current_user.id} cho Agent {request.agent_id}")
    return await service.process_chat(
        request.agent_id, 
        current_user.id, 
        request.message,
        thread_id=request.thread_id,
        command=request.command
    )

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint chính để chat stream (SSE)
    """
    logger.info(f"🌊 Nhận yêu cầu chat (Stream) từ User {current_user.id} cho Agent {request.agent_id}")
    return await service.stream_chat(
        request.agent_id,
        current_user.id,
        request.message,
        thread_id=request.thread_id,
        command=request.command
    )

@router.get("/conversations")
async def get_conversations(
    agent_id: Optional[str] = None,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các phiên hội thoại"""
    return await service.get_conversations(current_user.id, agent_id)

@router.get("/history/{thread_id}")
async def get_thread_history(
    thread_id: str,
    service: ChatService = Depends(get_chat_service),
    current_user: User = Depends(get_current_user)
):
    """Lấy lịch sử tin nhắn của một thread"""
    return await service.get_thread_history(thread_id, current_user.id)
