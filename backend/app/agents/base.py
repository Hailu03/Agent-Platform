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
        self.tools = get_tools_by_names(self.tool_names, self.config)
        self.tools_map = {tool.name: tool for tool in self.tools}
        
        # Bind tools nếu có
        if self.tools:
            # Chỉ cho LLM thấy các công cụ "mặt tiền"
            internal_tool_names = ["web_reader", "pdf_reader"]
            public_tools = [t for t in self.tools if t.name not in internal_tool_names]
            
            # Cập nhật mô tả tool GraphRAG dựa trên file thực tế
            knowledge_files = agent_config.get("knowledge_files", [])
            if knowledge_files:
                kb_names = []
                for f in knowledge_files:
                    if isinstance(f, dict):
                        # Ưu tiên lấy 'name' hoặc 'filename'
                        fname = f.get("name") or f.get("filename") or str(f)
                        kb_names.append(fname)
                    else:
                        kb_names.append(str(f))
                
                kb_list_str = ", ".join(kb_names)
                for tool in self.tools:
                    if tool.name == "graph_rag_search":
                        tool.description = f"BẮT BUỘC DÙNG ĐẦU TIÊN để tra cứu thông tin trong các tài liệu: [{kb_list_str}]. Chỉ dùng công cụ khác nếu không tìm thấy ở đây."
            
            if public_tools:
                logger.info(f"🔗 Đang thực hiện gán (binding) {len(public_tools)} công cụ công khai vào Model: {[t.name for t in public_tools]}")
                self.llm = self.llm.bind_tools(public_tools)
            else:
                logger.info("ℹ️ Không có công cụ công khai nào để gán vào Model.")

        # Tạo prompt tổng hợp từ cấu hình (gọi sau khi đã nạp tools)
        self.system_prompt = self._build_system_prompt()
        
        # Xây dựng và biên dịch Graph (Hỗ trợ Checkpointer để lưu trạng thái phiên chat)
        self.workflow = self._create_workflow()
        checkpointer = agent_config.get("checkpointer")
        store = agent_config.get("store")
        self.app = self.workflow.compile(checkpointer=checkpointer, store=store)

    def _build_system_prompt(self) -> str:
        """
        Kết hợp cấu hình thành một Prompt duy nhất bằng định dạng template.
        """
        name = self.config.get("name", "AI Agent")
        specialty = self.config.get("specialty", "Chưa xác định")
        description = self.config.get("description", "Không có mô tả")
        instructions = self.config.get("instructions", "")

        # Chỉ cho LLM thấy các công cụ "mặt tiền"
        internal_tool_names = ["web_reader", "pdf_reader"]
        public_tools = [t for t in self.tools if t.name not in internal_tool_names]
        
        # Chỉ liệt kê tool trong Prompt để LLM dễ nhận diện (Hỗ trợ tốt cho model Gemma/Ollama)
        tools_description = ""
        if public_tools:
            tools_description = "--- DANH SÁCH CÔNG CỤ BẠN ĐANG CÓ ---\n"
            for tool in public_tools:
                tools_description += f"- {tool.name}: {tool.description}\n"
            tools_description += "\n"
        else:
            tools_description = "Bạn hiện không có công cụ bổ sung nào.\n\n"

        # Tạo danh sách file kiến thức (nếu có)
        knowledge_files = self.config.get("knowledge_files", [])
        kb_info = ""
        if knowledge_files:
            kb_info = "📚 DANH SÁCH TÀI LIỆU NỘI BỘ (KHO TRI THỨC):\n"
            for f in knowledge_files:
                if isinstance(f, dict):
                    fname = f.get("name") or f.get("filename") or str(f)
                else:
                    fname = str(f)
                kb_info += f"- {fname}\n"
            kb_info += "\n"
        else:
            kb_info = "⚠️ LƯU Ý: Hiện tại KHÔNG có tài liệu nội bộ nào được nạp.\n\n"

        template = (
            "BẠN LÀ {name}.\n"
            "Chuyên môn: {specialty}\n"
            "Vai trò: {description}\n\n"
            "THỜI GIAN HIỆN TẠI: {current_time}\n\n"
            "{kb_info}"
            "{tools_list}"
            "--- QUY TẮC BẮT BUỘC ---\n"
            "1. KHÔNG BAO GIỜ hiển thị quá trình suy nghĩ, lập kế hoạch hoặc các bước thực hiện nội bộ trực tiếp cho người dùng. Người dùng chỉ quan tâm đến kết quả cuối cùng.\n"
            "2. Nếu bạn cần phân tích hoặc lập kế hoạch trước khi hành động, hãy bọc nội dung đó trong thẻ `<thinking>...</thinking>`. Nội dung này sẽ được hệ thống xử lý riêng và không hiển thị thô cho người dùng.\n"
            "3. LUÔN LUÔN ưu tiên sử dụng SKILL trước khi sử dụng bất kỳ công cụ nào khác. Nếu câu hỏi liên quan đến một kỹ năng bạn có, hãy gọi 'load_skill' ngay lập tức.\n"
            "4. Skill sẽ cung cấp hướng dẫn chi tiết cách sử dụng các công cụ (như query_database). Bạn PHẢI tuân thủ các hướng dẫn trong Skill.\n"
            "5. Nếu câu hỏi liên quan đến nội dung trong KHO TRI THỨC, bạn PHẢI gọi 'graph_rag_search' để tìm ngữ cảnh.\n"
            "6. Chỉ sử dụng 'web_search' sau khi đã tra cứu kiến thức nội bộ mà không có kết quả.\n"
            "7. Sử dụng 'gmail_manager' khi người dùng yêu cầu đọc, gửi hoặc quản lý email.\n\n"
            "{instructions}"
        )
        
        final_prompt = template.format(
            name=name,
            specialty=specialty,
            description=description,
            current_time=datetime.now().strftime("%A, %d/%m/%Y %H:%M:%S"),
            tools_list=tools_description,
            kb_info=kb_info,
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
