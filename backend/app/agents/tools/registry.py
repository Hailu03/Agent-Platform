from typing import List, Dict, Any
from langchain_core.tools import BaseTool
from app.agents.tools.web_search import SearxngSearchTool
from app.agents.tools.web_reader import WebReaderTool

def get_tools_by_names(tool_configs: List[Any]) -> List[BaseTool]:
    """
    Map tool configs to actual LangChain tool instances.
    Consolidated into a unified search experience.
    """
    # Chúng ta vẫn giữ các class riêng lẻ ở đây để LangGraph có thể gọi 
    # nhưng trên giao diện sẽ chỉ hiện thị một cổng vào duy nhất.
    registry = {
        "web_search": SearxngSearchTool(),
        "web_reader": WebReaderTool(),
        "Tìm kiếm Web": SearxngSearchTool(), # Cổng vào chính
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
            
            # NẾU là công cụ tìm kiếm, tự động nạp thêm web_reader để LangGraph dùng ngầm
            if name in ["Tìm kiếm Web", "web_search"] and "web_reader" not in [t.name for t in tools]:
                tools.append(registry["web_reader"])
            
    return tools

def get_available_tools() -> List[Dict[str, str]]:
    """
    Chỉ hiển thị DUY NHẤT một công cụ tìm kiếm thông minh trên Frontend.
    """
    return [
        {
            "name": "Tìm kiếm Web",
            "description": "Công cụ tìm kiếm thông minh: Tự động tìm kiếm, truy cập và đọc sâu nội dung các trang web để cung cấp báo cáo chi tiết nhất.",
            "icon": "Search"
        }
    ]
