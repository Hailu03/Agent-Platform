from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.workflow import Workflow
from typing import List, Optional

class WorkflowRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, workflow_id: str, user_id: str) -> Optional[Workflow]:
        result = await self.db.execute(
            select(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
        )
        return result.scalars().first()

    async def list_by_user(self, user_id: str) -> List[Workflow]:
        result = await self.db.execute(
            select(Workflow).where(Workflow.user_id == user_id)
        )
        return result.scalars().all()

    async def create(self, workflow: Workflow) -> Workflow:
        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def update(self, workflow: Workflow) -> Workflow:
        await self.db.commit()
        await self.db.refresh(workflow)
        return workflow

    async def delete(self, workflow_id: str, user_id: str):
        from sqlalchemy import delete as sa_delete
        await self.db.execute(
            sa_delete(Workflow).where(Workflow.id == workflow_id, Workflow.user_id == user_id)
        )
        await self.db.commit()
