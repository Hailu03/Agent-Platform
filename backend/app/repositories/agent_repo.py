from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.agent import Agent
from typing import List, Optional

class AgentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, agent_id: str, user_id: str) -> Optional[Agent]:
        result = await self.db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.user_id == user_id)
        )
        return result.scalars().first()

    async def list_by_user(self, user_id: str) -> List[Agent]:
        result = await self.db.execute(
            select(Agent).where(Agent.user_id == user_id)
        )
        return result.scalars().all()

    async def create(self, agent: Agent) -> Agent:
        self.db.add(agent)
        await self.db.commit()
        await self.db.refresh(agent)
        return agent

    async def update(self, agent: Agent) -> Agent:
        await self.db.commit()
        await self.db.refresh(agent)
        return agent
