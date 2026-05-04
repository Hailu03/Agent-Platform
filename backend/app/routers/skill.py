from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.models.base import get_db
from app.models.user import User
from app.models.skill import Skill
from app.schemas.skill import SkillCreate, SkillUpdate, SkillResponse
from app.core.security import get_current_user
from app.repositories.skill_repo import SkillRepository

router = APIRouter(prefix="/skills", tags=["Skills"])

def get_skill_repo(db: AsyncSession = Depends(get_db)) -> SkillRepository:
    return SkillRepository(db)

@router.post("/", response_model=SkillResponse)
async def create_skill(
    skill_in: SkillCreate,
    repo: SkillRepository = Depends(get_skill_repo),
    current_user: User = Depends(get_current_user)
):
    db_skill = Skill(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        **skill_in.model_dump()
    )
    return await repo.create(db_skill)

@router.get("/", response_model=List[SkillResponse])
async def list_skills(
    repo: SkillRepository = Depends(get_skill_repo),
    current_user: User = Depends(get_current_user)
):
    return await repo.list_by_user(current_user.id)

@router.get("/{skill_id}", response_model=SkillResponse)
async def get_skill(
    skill_id: str,
    repo: SkillRepository = Depends(get_skill_repo),
    current_user: User = Depends(get_current_user)
):
    skill = await repo.get_by_id(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỹ năng")
    return skill

@router.patch("/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: str,
    skill_in: SkillUpdate,
    repo: SkillRepository = Depends(get_skill_repo),
    current_user: User = Depends(get_current_user)
):
    skill = await repo.get_by_id(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỹ năng")
    
    update_data = skill_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(skill, field, value)
    
    return await repo.update(skill)

@router.delete("/{skill_id}")
async def delete_skill(
    skill_id: str,
    repo: SkillRepository = Depends(get_skill_repo),
    current_user: User = Depends(get_current_user)
):
    skill = await repo.get_by_id(skill_id, current_user.id)
    if not skill:
        raise HTTPException(status_code=404, detail="Không tìm thấy kỹ năng")
    
    await repo.delete(skill)
    return {"success": True}
