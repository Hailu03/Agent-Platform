from abc import ABC, abstractmethod
from langgraph.graph import StateGraph
from app.agents.factory import get_model

class BaseWAOAgent(ABC):
    """
    Lớp cơ sở trừu tượng cho tất cả các WAO Agents.
    Cung cấp khung xương để xây dựng các Graph phức tạp.
    """
    def __init__(self, agent_config: dict):
        self.config = agent_config
        self.provider = agent_config.get("model_provider", "openai")
        self.model_name = agent_config.get("model_name", "gpt-4o")
        self.api_key = agent_config.get("api_key")
        self.instructions = agent_config.get("instructions", "You are a helpful assistant.")
        
        # Tạo prompt tổng hợp từ cấu hình
        self.system_prompt = self._build_system_prompt()
        
        # Khởi tạo model từ factory
        self.llm = get_model(self.provider, self.model_name, api_key=self.api_key)
        
        # Xây dựng và biên dịch Graph
        self.workflow = self._create_workflow()
        self.app = self.workflow.compile()

    def _build_system_prompt(self) -> str:
        """
        Kết hợp cấu hình thành một Prompt duy nhất bằng định dạng template.
        """
        name = self.config.get("name", "AI Agent")
        specialty = self.config.get("specialty", "Chưa xác định")
        description = self.config.get("description", "Không có mô tả")
        instructions = self.config.get("instructions", "")

        template = (
            "BẠN LÀ {name}.\n"
            "TUYỆT ĐỐI KHÔNG giới thiệu bạn là AI của Google hay OpenAI.\n"
            "Chuyên môn: {specialty}\n"
            "Vai trò & Nhiệm vụ: {description}\n\n"
            "--- CHỈ DẪN HỆ THỐNG QUAN TRỌNG ---\n"
            "{instructions}"
        )
        
        return template.format(
            name=name,
            specialty=specialty,
            description=description,
            instructions=instructions
        )

    @abstractmethod
    def _create_workflow(self) -> StateGraph:
        """
        Các lớp con phải implement phương thức này để định nghĩa Nodes và Edges.
        """
        pass

    async def call_llm(self, messages: list):
        """
        Phương thức dùng chung để gọi Model
        """
        return await self.llm.ainvoke(messages)
