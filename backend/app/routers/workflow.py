from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.models.base import get_db
from app.models.user import User
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowResponse
from app.core.security import get_current_user
from app.repositories.workflow_repo import WorkflowRepository
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/workflows", tags=["Workflows"])

def get_workflow_service(db: AsyncSession = Depends(get_db)) -> WorkflowService:
    repo = WorkflowRepository(db)
    return WorkflowService(repo)

@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_in: WorkflowCreate,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    return await service.create_workflow(workflow_in, current_user.id)

@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    return await service.list_workflows(current_user.id)

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    workflow = await service.get_workflow(workflow_id, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình")
    return workflow

@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    workflow = await service.update_workflow(workflow_id, workflow_in, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình để cập nhật")
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    success = await service.delete_workflow(workflow_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình để xóa")
    return None
