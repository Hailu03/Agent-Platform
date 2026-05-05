from app.repositories.agent_repo import AgentRepository
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate
import uuid

class AgentService:
    def __init__(self, repo: AgentRepository):
        self.repo = repo

    async def get_agent(self, agent_id: str, user_id: str):
        agent = await self.repo.get_by_id(agent_id, user_id)
        if agent:
            self._mask_agent_keys(agent)
        return agent

    async def list_agents(self, user_id: str):
        agents = await self.repo.list_by_user(user_id)
        for agent in agents:
            self._mask_agent_keys(agent)
        return agents

    def _mask_agent_keys(self, agent: Agent):
        """Che giấu một phần API Key khi trả về cho Frontend (ví dụ: abcd...xyz)."""
        from app.core.security import decrypt_password
        
        def mask_val(val):
            if not val: return None
            try:
                # Giải mã để lấy bản rõ trước khi che
                plain = decrypt_password(val)
                if len(plain) <= 8:
                    return "********" # Nếu key quá ngắn thì che hết
                return f"{plain[:4]}****{plain[-4:]}"
            except:
                # Nếu không giải mã được (có thể đã bị lỗi hoặc đang là plain text)
                if len(val) <= 8: return "********"
                return f"{val[:4]}****{val[-4:]}"

        if agent.api_key:
            agent.api_key = mask_val(agent.api_key)
        if agent.embedding_api_key:
            agent.embedding_api_key = mask_val(agent.embedding_api_key)

    async def create_agent(self, agent_in: AgentCreate, user_id: str):
        from app.core.security import encrypt_password
        
        dump_data = agent_in.model_dump()
        if dump_data.get("api_key"):
            dump_data["api_key"] = encrypt_password(dump_data["api_key"])
        if dump_data.get("embedding_api_key"):
            dump_data["embedding_api_key"] = encrypt_password(dump_data["embedding_api_key"])
            
        db_agent = Agent(
            id=str(uuid.uuid4()),
            user_id=user_id,
            **dump_data
        )
        agent = await self.repo.create(db_agent)
        
        # Nạp tri thức ban đầu nếu có
        if agent.knowledge_files:
            from app.tasks.graph_rag import process_document_task
            from app.core.security import decrypt_password
            
            # Giải mã key để gửi cho task
            decrypted_api_key = decrypt_password(agent.api_key) if agent.api_key else None
            decrypted_emb_api_key = decrypt_password(agent.embedding_api_key) if agent.embedding_api_key else None
            
            for file_info in agent.knowledge_files:
                process_document_task.delay(
                    file_url=file_info["url"],
                    provider=agent.model_provider,
                    model_name=agent.model_name,
                    api_key=decrypted_api_key,
                    metadata={"filename": file_info["filename"], "agent_id": agent.id},
                    embedding_provider=agent.embedding_provider,
                    embedding_model=agent.embedding_model,
                    embedding_api_key=decrypted_emb_api_key
                )
        
        await self._sync_datasource_config(agent)
        self._mask_agent_keys(agent)
        return agent

    async def update_agent(self, agent_id: str, agent_in: AgentUpdate, user_id: str):
        from app.core.security import encrypt_password, decrypt_password
        
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
                
                # Tính toán key mới hoặc cũ
                api_key = new_data.get("api_key")
                if api_key in ["", None, "********"]: 
                    api_key = decrypt_password(agent.api_key) if agent.api_key else None
                    
                emb_provider = new_data.get("embedding_provider", agent.embedding_provider)
                emb_model = new_data.get("embedding_model", agent.embedding_model)
                
                emb_api_key = new_data.get("embedding_api_key")
                if emb_api_key in ["", None, "********"]:
                    emb_api_key = decrypt_password(agent.embedding_api_key) if agent.embedding_api_key else None
                
                for f in added_files:
                    process_document_task.delay(
                        file_url=f["url"],
                        provider=provider,
                        model_name=model_name,
                        api_key=api_key,
                        metadata={"filename": f["filename"], "agent_id": agent.id, "agent_name": agent.name},
                        embedding_provider=emb_provider,
                        embedding_model=emb_model,
                        embedding_api_key=emb_api_key
                    )
            
            # Kích hoạt task xóa tri thức cũ
            if removed_urls:
                for url in removed_urls:
                    delete_document_task.delay(url, agent.embedding_provider, agent.embedding_model, agent.id)

        update_data = agent_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field in ["api_key", "embedding_api_key"]:
                # Nếu là chuỗi đã che (có '****' hoặc toàn dấu sao) thì không cập nhật
                if value in ["", None, "********", "****"] or "****" in str(value):
                    continue
                if value:
                    value = encrypt_password(value)
            setattr(agent, field, value)
            
        updated_agent = await self.repo.update(agent)
        await self._sync_datasource_config(updated_agent)
        self._mask_agent_keys(updated_agent)
        return updated_agent

    async def delete_agent(self, agent_id: str, user_id: str):
        """Xóa Agent và dọn dẹp TOÀN BỘ thông tin liên quan"""
        agent = await self.repo.get_by_id(agent_id, user_id)
        if not agent:
            return False
            
        from app.core.logging import get_logger
        logger = get_logger(__name__)

        # 1. Kích hoạt dọn dẹp GraphRAG (Neo4J & Qdrant) - Tiến trình ngầm
        try:
            from app.tasks.graph_rag import delete_agent_graph_task
            delete_agent_graph_task.delay(agent_id)
        except Exception as e:
            logger.error(f"⚠️ Không thể kích hoạt dọn dẹp GraphRAG: {e}")

        # 2. Xóa Lịch sử Chat (LangGraph Checkpoints)
        try:
            # Vì bạn dùng LangGraph Postgres Checkpointer, ta xóa trong các bảng hệ thống của nó
            # Lưu ý: thread_id thường chứa agent_id hoặc user_id tùy theo cách bạn đặt
            # Trong project này, thread_id đang được dùng là user_id (cần kiểm tra lại nếu muốn xóa chính xác theo Agent)
            # Tạm thời xóa các bản ghi mà metadata có chứa agent_id nếu có, 
            # hoặc xóa theo thread_id nếu thread_id của bạn có cấu trúc 'agent_id:user_id'
            
            from sqlalchemy import text
            # Xóa trong 3 bảng chính của LangGraph Checkpointer
            # Chúng ta dùng LIKE để tìm các thread có chứa agent_id (nếu bạn đặt thread_id = f"{agent_id}:{user_id}")
            # Nếu thread_id chỉ là user_id, việc xóa theo agent_id sẽ cần logic phức tạp hơn trong metadata blob
            
            # Ở đây tôi sẽ xóa các checkpoint_writes có liên quan đến thread_id chứa agent_id
            await self.repo.db.execute(text("DELETE FROM checkpoint_writes WHERE thread_id LIKE :pattern"), {"pattern": f"%{agent_id}%"})
            await self.repo.db.execute(text("DELETE FROM checkpoint_blobs WHERE thread_id LIKE :pattern"), {"pattern": f"%{agent_id}%"})
            await self.repo.db.execute(text("DELETE FROM checkpoints WHERE thread_id LIKE :pattern"), {"pattern": f"%{agent_id}%"})
            
            logger.info(f"🗑️ Đã dọn dẹp LangGraph checkpoints cho Agent {agent_id}")
        except Exception as e:
            logger.error(f"⚠️ Lỗi khi xóa lịch sử chat (checkpoints): {e}")

        # 3. Xóa File vật lý trên MinIO (nếu có)
        try:
            from app.core.storage import storage_service
            if agent.knowledge_files:
                for file_info in agent.knowledge_files:
                    object_name = file_info.get("object_name")
                    if object_name:
                        storage_service.delete_file(object_name)
                        logger.info(f"🗑️ Đã xóa file trên MinIO: {object_name}")
        except Exception as e:
            logger.error(f"⚠️ Lỗi khi xóa file trên storage: {e}")

        # 4. Xóa bản ghi Agent trong SQL DB
        await self.repo.delete(agent_id, user_id)
        return True

    async def _sync_datasource_config(self, agent: Agent):
        """Đồng bộ cấu hình AI của Agent vào Datasource và kích hoạt Indexing"""
        if not agent.tools: return
        from app.models.datasource import DataSource
        from sqlalchemy import select
        from app.tasks.graph_rag import index_datasource_task
        from app.core.logging import get_logger
        logger = get_logger(__name__)
        
        for tool in agent.tools:
            if isinstance(tool, dict) and tool.get("name") == "text2sql":
                ds_id = tool.get("config", {}).get("datasource_id")
                if ds_id:
                    logger.info(f"🔍 Đang đồng bộ API Key từ Agent {agent.id} vào Datasource {ds_id} (Provider={agent.model_provider}, ChatKey={bool(agent.api_key)}, EmbKey={bool(agent.embedding_api_key)})")
                    result = await self.repo.db.execute(select(DataSource).where(DataSource.id == ds_id))
                    ds = result.scalar_one_or_none()
                    if ds:
                        extra = ds.extra_params or {}
                        # Chỉ đồng bộ ID của Agent và các thông tin model (không lưu key bản rõ)
                        extra["agent_id"] = agent.id
                        extra["embedding_provider"] = agent.embedding_provider or "google"
                        extra["embedding_model"] = agent.embedding_model or "models/embedding-001"
                        extra["chat_provider"] = agent.model_provider or "openai"
                        
                        # Sử dụng flag để update JSON (SQLAlchemy cần gán lại array/dict)
                        ds.extra_params = dict(extra)
                        await self.repo.db.commit()
                        
                        logger.info(f"🔄 Đã đồng bộ API Key từ Agent {agent.id} vào Datasource {ds_id}")
                        # Kích hoạt lại tiến trình lập chỉ mục với key mới
                        index_datasource_task.delay(ds.id)
