from abc import ABC, abstractmethod
from langgraph.graph import StateGraph
from app.agents.factory import get_model
from app.agents.tools.registry import get_tools_by_names
from app.core.logging import get_logger
from datetime import datetime

# Khởi tạo logger
logger = get_logger(__name__)

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
        
        logger.info(f"🤖 Khởi tạo Agent: {agent_config.get('name')} | Model: {self.model_name} ({self.provider})")

        # Khởi tạo model từ factory
        self.llm = get_model(self.provider, self.model_name, api_key=self.api_key)
        
        # Khởi tạo tools
        self.tool_names = agent_config.get("tools", [])
        self.tools = get_tools_by_names(self.tool_names)
        self.tools_map = {tool.name: tool for tool in self.tools}
        
        logger.info(f"🛠️ Đã nạp {len(self.tools)} công cụ: {[t.name for t in self.tools]}")
        
        # Bind tools nếu có (Giấu web_reader khỏi LLM để LangGraph điều phối ngầm)
        if self.tools:
            # Chỉ cho LLM thấy các công cụ công khai, giấu các công cụ phục vụ flow ngầm
            public_tools = [t for t in self.tools if t.name != "web_reader"]
            if public_tools:
                logger.info(f"🔗 Đang thực hiện gán (binding) {len(public_tools)} công cụ công khai vào Model...")
                self.llm = self.llm.bind_tools(public_tools)
            else:
                logger.info("ℹ️ Không có công cụ công khai nào để gán vào Model.")
        
        # Tạo prompt tổng hợp từ cấu hình (gọi sau khi đã nạp tools)
        self.system_prompt = self._build_system_prompt()
        
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

        # Tạo danh sách công cụ để đưa vào prompt
        tools_description = ""
        if self.tools:
            tools_description = "DANH SÁCH CÔNG CỤ BẠN ĐANG CÓ:\n"
            for tool in self.tools:
                tools_description += f"- {tool.name}: {tool.description}\n"
        else:
            tools_description = "Bạn hiện không có công cụ bổ sung nào."

        template = (
            "BẠN LÀ {name}.\n"
            "Chuyên môn: {specialty}\n"
            "Vai trò & Nhiệm vụ: {description}\n\n"
            "THỜI GIAN HIỆN TẠI: {current_time}\n\n"
            "--- CHỈ DẪN HỆ THỐNG QUAN TRỌNG ---\n"
            "1. Bạn có quyền truy cập vào các CÔNG CỤ sau đây:\n"
            "{tools_list}\n"
            "2. Khi nhận được câu hỏi về THÔNG TIN HIỆN TẠI, THỜI SỰ, GIÁ CẢ hoặc thông tin mới nhất, bạn BẮT BUỘC phải gọi công cụ tương ứng (ví dụ: 'web_search') để tra cứu.\n"
            "3. Luôn ưu tiên thông tin thực tế từ kết quả công cụ trả về.\n\n"
            "{instructions}"
        )
        
        final_prompt = template.format(
            name=name,
            specialty=specialty,
            description=description,
            current_time=datetime.now().strftime("%A, %d/%m/%Y %H:%M:%S"),
            tools_list=tools_description,
            instructions=instructions
        )
        
        logger.debug(f"📝 Final System Prompt (length: {len(final_prompt)} characters)")
        return final_prompt

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
