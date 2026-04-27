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
        agent = await self.repo.create(db_agent)
        
        # Nạp tri thức ban đầu nếu có
        if agent.knowledge_files:
            from app.tasks.graph_rag import process_document_task
            for file_info in agent.knowledge_files:
                process_document_task.delay(
                    file_url=file_info["url"],
                    provider=agent.model_provider,
                    model_name=agent.model_name,
                    api_key=agent.api_key,
                    metadata={"filename": file_info["filename"], "agent_id": agent.id},
                    embedding_provider=agent.embedding_provider,
                    embedding_model=agent.embedding_model,
                    embedding_api_key=agent.embedding_api_key
                )
        return agent

    async def update_agent(self, agent_id: str, agent_in: AgentUpdate, user_id: str):
        agent = await self.repo.get_by_id(agent_id, user_id)
        if not agent:
            return None
        
        # Kiểm tra sự thay đổi của knowledge_files
        new_data = agent_in.model_dump(exclude_unset=True)
        if "knowledge_files" in new_data:
            old_files = agent.knowledge_files or []
            new_files = new_data["knowledge_files"] or []
            
            def get_url(f):
                if isinstance(f, dict):
                    return f.get("url")
                return f if isinstance(f, str) and (f.startswith("http") or "/" in f) else None

            old_urls = {get_url(f) for f in old_files if get_url(f)}
            new_urls = {get_url(f) for f in new_files if get_url(f)}
            
            # 1. Tìm các file MỚI (có trong new nhưng không có trong old)
            added_files = [
                f for f in new_files 
                if isinstance(f, dict) and f.get("url") and f.get("url") not in old_urls
            ]
            
            # 2. Tìm các file bị XÓA
            removed_urls = old_urls - new_urls
            
            from app.tasks.graph_rag import process_document_task, delete_document_task
            
            # Kích hoạt task nạp tri thức mới
            if added_files:
                provider = new_data.get("model_provider", agent.model_provider)
                model_name = new_data.get("model_name", agent.model_name)
                # Nếu gửi lên chuỗi rỗng, dùng lại key cũ từ DB
                api_key = new_data.get("api_key")
                if api_key == "": api_key = agent.api_key
                elif api_key is None: api_key = agent.api_key
                
                emb_provider = new_data.get("embedding_provider", agent.embedding_provider)
                emb_model = new_data.get("embedding_model", agent.embedding_model)
                emb_api_key = new_data.get("embedding_api_key")
                if emb_api_key == "": emb_api_key = agent.embedding_api_key
                elif emb_api_key is None: emb_api_key = agent.embedding_api_key
                
                for f in added_files:
                    process_document_task.delay(
                        file_url=f["url"],
                        provider=provider,
                        model_name=model_name,
                        api_key=api_key,
                        metadata={"filename": f["filename"], "agent_id": agent.id},
                        embedding_provider=emb_provider,
                        embedding_model=emb_model,
                        embedding_api_key=emb_api_key
                    )
            
            # Kích hoạt task xóa tri thức cũ
            if removed_urls:
                for url in removed_urls:
                    delete_document_task.delay(url, agent.embedding_provider, agent.embedding_model)

        update_data = agent_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            # Quan trọng: Nếu là trường Key và giá trị gửi lên là chuỗi rỗng, không ghi đè (giữ key cũ)
            if field in ["api_key", "embedding_api_key"] and value == "":
                continue
            setattr(agent, field, value)
            
        return await self.repo.update(agent)
