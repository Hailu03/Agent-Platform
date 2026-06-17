from typing import Type, Optional
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from app.services.data.graph_rag_service import GraphRAGService
from app.agents.factory import get_model
from app.core.logging import get_logger

logger = get_logger(__name__)

class GraphRAGInput(BaseModel):
    query: str = Field(description="Câu hỏi hoặc thuật ngữ cần tra cứu trong cơ sở tri thức chuyên sâu của Agent")

class GraphRAGSearchTool(BaseTool):
    name: str = "graph_rag_search"
    description: str = "Tìm kiếm thông tin trong cơ sở tri thức chuyên sâu (Knowledge Base) bằng công nghệ GraphRAG. Thích hợp cho các câu hỏi về mối quan hệ giữa các thực thể, phân tích báo cáo dài hoặc dữ liệu nội bộ của người dùng."
    args_schema: Type[BaseModel] = GraphRAGInput
    agent_config: dict = Field(default_factory=dict)

    def __init__(self, agent_config: dict = None, **kwargs):
        super().__init__(**kwargs)
        if agent_config:
            self.agent_config = agent_config

    def _run(self, query: str) -> str:
        import asyncio
        return asyncio.run(self._arun(query))

    async def _arun(self, query: str) -> str:
        logger.info(f"🕸️ Đang thực hiện GraphRAG Hybrid Search cho: {query}")
        
        try:
            # Lấy cấu hình từ Agent
            chat_provider = self.agent_config.get("model_provider", "google")
            chat_model = self.agent_config.get("model_name", "gemini-1.5-flash")
            chat_api_key = self.agent_config.get("api_key")
            
            emb_provider = self.agent_config.get("embedding_provider", chat_provider)
            emb_model = self.agent_config.get("embedding_model", "models/embedding-001")
            emb_api_key = self.agent_config.get("embedding_api_key")
            
            # Khởi tạo model phục vụ cho việc query (Dùng bản không stream cho xử lý nội bộ của Tool)
            llm_internal = get_model(chat_provider, chat_model, api_key=chat_api_key, streaming=False)
            
            # Chuẩn bị cấu hình embedding
            embedding_config = {
                "provider": emb_provider,
                "model": emb_model,
                "api_key": emb_api_key
            }

            service = GraphRAGService(
                llm=llm_internal,
                embedding_config=embedding_config,
                chat_api_key=chat_api_key,
                chat_provider=chat_provider,
                agent_id=self.agent_config.get("id"),
                agent_name=self.agent_config.get("name"),
                collection_type="kb"
            )
            
            result = await service.query(query)
            return result
        except Exception as e:
            logger.error(f"❌ Lỗi khi thực hiện GraphRAG Search: {str(e)}")
            return f"Không thể truy cập cơ sở tri thức lúc này: {str(e)}"
