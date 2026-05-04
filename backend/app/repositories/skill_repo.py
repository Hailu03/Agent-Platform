from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.skill import Skill
from typing import List, Optional

class SkillRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, skill_id: str, user_id: str) -> Optional[Skill]:
        result = await self.db.execute(
            select(Skill).where(Skill.id == skill_id, Skill.user_id == user_id)
        )
        return result.scalars().first()

    async def list_by_user(self, user_id: str) -> List[Skill]:
        result = await self.db.execute(
            select(Skill).where((Skill.user_id == user_id) | (Skill.is_template == True))
        )
        return result.scalars().all()

    async def create(self, skill: Skill) -> Skill:
        self.db.add(skill)
        await self.db.commit()
        await self.db.refresh(skill)
        return skill

    async def update(self, skill: Skill) -> Skill:
        await self.db.commit()
        await self.db.refresh(skill)
        return skill
    
    async def delete(self, skill: Skill) -> None:
        await self.db.delete(skill)
        await self.db.commit()
