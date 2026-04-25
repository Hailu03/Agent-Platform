from app.repositories.agent_repo import AgentRepository
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate
import uuid

class AgentService:
    def __init__(self, repo: AgentRepository):
        self.repo = repo

    async def get_agent(self, agent_id: str, user_id: str):
        return await self.repo.get_by_id(agent_id, user_id)

    async def list_agents(self, user_id: str):
        return await self.repo.list_by_user(user_id)

    async def create_agent(self, agent_in: AgentCreate, user_id: str):
        db_agent = Agent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            **agent_in.model_dump()
        )
        return await self.repo.create(db_agent)

    async def update_agent(self, agent_id: str, agent_in: AgentUpdate, user_id: str):
        agent = await self.repo.get_by_id(agent_id, user_id)
        if not agent:
            return None
        
        update_data = agent_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(agent, field, value)
            
        return await self.repo.update(agent)
