from typing import List, Dict, Any
from langchain_core.tools import BaseTool
from app.agents.tools.web_search import SearxngSearchTool
from app.agents.tools.web_reader import WebReaderTool
from app.agents.tools.pdf_reader import PDFReaderTool
from app.agents.tools.graph_rag import GraphRAGSearchTool
from app.core.logging import get_logger

logger = get_logger(__name__)

def get_tools_by_names(tool_configs: List[Any], agent_config: dict = None) -> List[BaseTool]:
    """
    Map tool configs to actual LangChain tool instances.
    Consolidated into a unified search experience.
    """
    # Khởi tạo registry bên trong để có thể truyền agent_config cho các Tool cần thiết
    registry = {
        "web_search": SearxngSearchTool(),
        "web_reader": WebReaderTool(),
        "pdf_reader": PDFReaderTool(),
        "graph_rag_search": GraphRAGSearchTool(agent_config=agent_config),
        "Tìm kiếm Internet": SearxngSearchTool(), 
        "Tìm kiếm Web": SearxngSearchTool(), # Khớp với UI
    }
    
    tools = []
    for config in tool_configs:
        if isinstance(config, str):
            name = config
            is_active = True
        else:
            name = config.get("name")
            is_active = config.get("is_active", True)
            
        if is_active and name in registry:
            tool = registry[name]
            tools.append(tool)
            
            # NẾU là công cụ tìm kiếm, tự động nạp thêm các tool đọc chuyên sâu để LangGraph dùng ngầm
            if name in ["Tìm kiếm Internet", "Tìm kiếm Web", "web_search"]:
                needed_tools = ["web_reader", "pdf_reader"]
                for tool_name in needed_tools:
                    if tool_name not in [t.name for t in tools]:
                        tools.append(registry[tool_name])
        
    # --- TỰ ĐỘNG NẠP GRAPHRAG NẾU CÓ FILE KIẾN THỨC ---
    if agent_config and agent_config.get("knowledge_files"):
        if "graph_rag_search" not in [t.name for t in tools]:
            logger.info(f"📚 Phát hiện {len(agent_config['knowledge_files'])} file kiến thức. Tự động nạp GraphRAG Tool.")
            tools.append(registry["graph_rag_search"])
            
    return tools

def get_available_tools() -> List[Dict[str, str]]:
    """
    Chỉ hiển thị DUY NHẤT một công cụ tìm kiếm thông minh trên Frontend.
    """
    return [
        {
            "name": "Tìm kiếm Web",
            "description": "Tự động tìm kiếm, truy cập và đọc sâu nội dung các trang web để cung cấp báo cáo chi tiết nhất.",
            "icon": "Search"
        }
    ]
