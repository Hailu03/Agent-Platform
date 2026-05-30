from app.repositories.workflow_repo import WorkflowRepository
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate
import uuid

class WorkflowService:
    def __init__(self, repo: WorkflowRepository):
        self.repo = repo

    async def get_workflow(self, workflow_id: str, user_id: str):
        return await self.repo.get_by_id(workflow_id, user_id)

    async def list_workflows(self, user_id: str):
        return await self.repo.list_by_user(user_id)

    async def create_workflow(self, workflow_in: WorkflowCreate, user_id: str):
        db_workflow = Workflow(
            id=str(uuid.uuid4()),
            user_id=user_id,
            **workflow_in.model_dump()
        )
        return await self.repo.create(db_workflow)

    async def update_workflow(self, workflow_id: str, workflow_in: WorkflowUpdate, user_id: str):
        db_workflow = await self.repo.get_by_id(workflow_id, user_id)
        if not db_workflow:
            return None
        
        update_data = workflow_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_workflow, field, value)
            
        return await self.repo.update(db_workflow)

    async def delete_workflow(self, workflow_id: str, user_id: str):
        db_workflow = await self.repo.get_by_id(workflow_id, user_id)
        if not db_workflow:
            return False
        await self.repo.delete(workflow_id, user_id)
        return True
