from typing import List, Dict, Any
from langchain_core.tools import BaseTool
from app.agents.tools.web_search import SearxngSearchTool
from app.agents.tools.web_reader import WebReaderTool
from app.agents.tools.pdf_reader import PDFReaderTool
from app.agents.tools.graph_rag import GraphRAGSearchTool
from app.agents.tools.skill_loader import SkillLoaderTool

from app.agents.tools.gmail import (
    GmailListTool, GmailReadTool, GmailSendTool, 
    GmailSearchTool, GmailDraftTool, GmailModifyTool, GmailReplyTool
)

# ... (rest of imports)

def get_tools_by_names(tool_configs: List[Any], agent_config: dict = None) -> List[BaseTool]:
    # ...
    registry = {
        "web_search": SearxngSearchTool(),
        "web_reader": WebReaderTool(),
        "pdf_reader": PDFReaderTool(),
        "graph_rag_search": GraphRAGSearchTool(agent_config=agent_config),
        "load_skill": SkillLoaderTool(),
        # Gmail Core
        "gmail_list": GmailListTool(),
        "gmail_read": GmailReadTool(),
        "gmail_send": GmailSendTool(),
        # Gmail Pro
        "gmail_search": GmailSearchTool(),
        "gmail_draft": GmailDraftTool(),
        "gmail_modify": GmailModifyTool(),
        "gmail_reply": GmailReplyTool(),
        
        "Tìm kiếm Web": SearxngSearchTool(), 
        "Gmail": [
            GmailListTool(), GmailReadTool(), GmailSendTool(),
            GmailSearchTool(), GmailDraftTool(), GmailModifyTool(), GmailReplyTool()
        ],
    }
    
    tools = []
    for config in tool_configs:
        name = config if isinstance(config, str) else config.get("name")
        is_active = True if isinstance(config, str) else config.get("is_active", True)
            
        if is_active and name in registry:
            t_obj = registry[name]
            if isinstance(t_obj, list):
                tools.extend(t_obj)
            else:
                tools.append(t_obj)
            
            # ...
    
    # ... (graph_rag and load_skill)
            
    # --- TỰ ĐỘNG NẠP GMAIL TOKEN ---
    google_tokens = agent_config.get("user_google_tokens") or {}
    gmail_tool_classes = (GmailListTool, GmailReadTool, GmailSendTool, GmailSearchTool, GmailDraftTool, GmailModifyTool, GmailReplyTool)
    for t in tools:
        if isinstance(t, gmail_tool_classes):
            t.user_tokens = google_tokens
            
    return tools

def get_available_tools() -> List[Dict[str, str]]:
    return [
        {
            "name": "Tìm kiếm Web",
            "description": "Tự động tìm kiếm và đọc sâu nội dung các trang web.",
            "icon": "Search",
            "category": "Cơ bản"
        },
        {
            "name": "gmail_search",
            "label": "Tìm kiếm Email nâng cao",
            "description": "Tìm kiếm email bằng query (VD: 'from:boss has:attachment').",
            "icon": "Search",
            "category": "Gmail"
        },
        {
            "name": "gmail_list",
            "label": "Danh sách thư chưa đọc",
            "description": "Tra cứu danh sách các email mới nhất trong hộp thư.",
            "icon": "Mail",
            "category": "Gmail"
        },
        {
            "name": "gmail_read",
            "label": "Xem nội dung chi tiết",
            "description": "Đọc nội dung và trích xuất dữ liệu từ một email cụ thể.",
            "icon": "Mail",
            "category": "Gmail"
        },
        {
            "name": "gmail_send",
            "label": "Gửi thư (HTML Support)",
            "description": "Soạn và gửi email mới với định dạng HTML chuyên nghiệp.",
            "icon": "Send",
            "category": "Gmail"
        },
        {
            "name": "gmail_draft",
            "label": "Quản lý bản nháp (Drafts)",
            "description": "Tạo, sửa hoặc xóa bản nháp để người dùng kiểm duyệt trước khi gửi.",
            "icon": "Edit2",
            "category": "Gmail"
        },
        {
            "name": "gmail_modify",
            "label": "Quản lý Nhãn & Trạng thái",
            "description": "Đánh dấu đã đọc, gắn sao, lưu trữ hoặc di chuyển vào thùng rác.",
            "icon": "Layers",
            "category": "Gmail"
        },
        {
            "name": "gmail_reply",
            "label": "Trả lời theo luồng (Reply)",
            "description": "Phản hồi trực tiếp vào một luồng hội thoại sẵn có.",
            "icon": "RotateCcw",
            "category": "Gmail"
        }
    ]
