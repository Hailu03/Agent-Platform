from typing import List, Dict, Any
import re
from langchain_core.tools import BaseTool
from app.agents.tools.web_search import SearxngSearchTool
from app.agents.tools.web_reader import WebReaderTool
from app.agents.tools.pdf_reader import PDFReaderTool
from app.agents.tools.graph_rag import GraphRAGSearchTool
from app.agents.tools.skill_loader import SkillLoaderTool
from app.agents.tools.text2sql import Text2SQLTool

from app.agents.tools.gmail import (
    GmailListTool, GmailReadTool, GmailSendTool, 
    GmailSearchTool, GmailDraftTool, GmailModifyTool, GmailReplyTool
)

# ... (rest of imports)

def sanitize_tool_name(name: str) -> str:
    """
    Chuyển đổi tên công cụ sang định dạng hợp lệ cho Gemini API:
    - Bắt đầu bằng chữ cái hoặc dấu gạch dưới.
    - Chỉ chứa ký tự chữ cái (không dấu), số, gạch dưới, chấm, hai chấm, gạch ngang.
    - Độ dài tối đa 128.
    """
    # 1. Loại bỏ dấu tiếng Việt (đơn giản)
    accents = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o', 'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'đ': 'd',
        'À': 'A', 'Á': 'A', 'Ả': 'A', 'Ã': 'A', 'Ạ': 'A', 'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ẳ': 'A', 'Ẵ': 'A', 'Ặ': 'A', 'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ẩ': 'A', 'Ẫ': 'A', 'Ậ': 'A',
        'È': 'E', 'É': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ẹ': 'E', 'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ể': 'E', 'Ễ': 'E', 'Ệ': 'E',
        'Ì': 'I', 'Í': 'I', 'Ỉ': 'I', 'Ĩ': 'I', 'Ị': 'I',
        'Ò': 'O', 'Ó': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ọ': 'O', 'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ổ': 'O', 'Ỗ': 'O', 'Ộ': 'O', 'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ở': 'O', 'Ỡ': 'O', 'Ợ': 'O',
        'Ù': 'U', 'Ú': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ụ': 'U', 'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ử': 'U', 'Ữ': 'U', 'Ự': 'U',
        'Ỳ': 'Y', 'Ý': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y', 'Ỵ': 'Y',
        'Đ': 'D'
    }
    for accent, replacement in accents.items():
        name = name.replace(accent, replacement)
    
    # 2. Thay thế khoảng trắng và ký tự không hợp lệ bằng dấu gạch dưới
    # Chỉ giữ lại a-zA-Z0-9._:-
    name = re.sub(r'[^a-zA-Z0-9._:-]', '_', name)
    
    # 3. Đảm bảo bắt đầu bằng chữ cái hoặc gạch dưới
    if not re.match(r'^[a-zA-Z_]', name):
        name = 't_' + name
        
    return name[:128]

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
        "text2sql": Text2SQLTool(agent_config=agent_config),
        
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
                # For lists (like Gmail), we add all but currently don't support individual overrides here
                tools.extend(t_obj)
            else:
                # Override name (label) and description if provided in config
                if not isinstance(config, str):
                    custom_label = config.get("label")
                    custom_desc = config.get("description")
                    fixed_params = config.get("params", {})
                    
                    if custom_label:
                        t_obj.name = sanitize_tool_name(custom_label)
                    if custom_desc:
                        t_obj.description = custom_desc
                    
                    # Inject fixed parameters as attributes
                    if fixed_params:
                        # Gán human_in_loop và rate_limit an toàn (bypass Pydantic check)
                        if "human_in_loop" in fixed_params:
                            object.__setattr__(t_obj, "human_in_loop", bool(fixed_params["human_in_loop"]))
                        if "rate_limit" in fixed_params:
                            try:
                                object.__setattr__(t_obj, "rate_limit", int(fixed_params["rate_limit"]))
                            except:
                                pass
                        if "thread_limit" in fixed_params:
                            try:
                                object.__setattr__(t_obj, "thread_limit", int(fixed_params["thread_limit"]))
                            except:
                                pass
                        if "run_limit" in fixed_params:
                            try:
                                object.__setattr__(t_obj, "run_limit", int(fixed_params["run_limit"]))
                            except:
                                pass

                        for k, v in fixed_params.items():
                            if hasattr(t_obj, k):
                                # Try to cast to correct type if it's an int
                                try:
                                    current_val = getattr(t_obj, k)
                                    if isinstance(current_val, int):
                                        object.__setattr__(t_obj, k, int(v))
                                    else:
                                        object.__setattr__(t_obj, k, v)
                                except:
                                    object.__setattr__(t_obj, k, v)
                    
                    # If we have fixed params, we wrap the tool to handle the execution
                    if fixed_params:
                        from langchain_core.tools import Tool
                        
                        # Get the original methods
                        original_run = t_obj._run
                        original_arun = t_obj._arun if hasattr(t_obj, "_arun") else None
                        
                        def wrapped_run(*args, **kwargs):
                            # For simple tools, we might need to merge params if they aren't attributes
                            # but for our current tools, setting attributes above is better.
                            return original_run(*args, **kwargs)
                        
                        async def wrapped_arun(*args, **kwargs):
                            if original_arun:
                                return await original_arun(*args, **kwargs)
                            return None

                        new_tool = Tool(
                            name=t_obj.name,
                            description=t_obj.description,
                            func=wrapped_run,
                            coroutine=wrapped_arun if original_arun else None
                        )
                        # Sao chép các thuộc tính vận hành sang wrapper để tool_nodes.py có thể nhận diện
                        for attr in ["human_in_loop", "rate_limit", "thread_limit", "run_limit"]:
                            if hasattr(t_obj, attr):
                                object.__setattr__(new_tool, attr, getattr(t_obj, attr))
                        
                        t_obj = new_tool
                        
                tools.append(t_obj)
            
    # --- AUTO-INJECTION OF CORE TOOLS ---
    # Auto-inject graph_rag_search if there are knowledge files
    if agent_config and agent_config.get("knowledge_files"):
        if not any(isinstance(t, GraphRAGSearchTool) for t in tools):
            tools.append(GraphRAGSearchTool(agent_config=agent_config))

    # Auto-inject load_skill if there are skills
    if agent_config and agent_config.get("skills"):
        if not any(isinstance(t, SkillLoaderTool) for t in tools):
            tools.append(SkillLoaderTool())

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
            "name": "web_search",
            "label": "Tìm kiếm Web",
            "description": "Tự động tìm kiếm và đọc sâu nội dung các trang web.",
            "icon": "Search",
            "category": "Cơ bản",
            "supported_params": [
                {
                    "key": "num_results", 
                    "label": "Số lượng kết quả", 
                    "type": "number", 
                    "default": 5,
                    "desc": "Số lượng trang web Agent sẽ đọc để lấy thông tin."
                },
                {
                    "key": "language", 
                    "label": "Ngôn ngữ", 
                    "type": "select", 
                    "default": "vi-VN",
                    "options": [
                        {"label": "Tiếng Việt", "value": "vi-VN"},
                        {"label": "Tiếng Anh", "value": "en-US"}
                    ]
                },
                {
                    "key": "engines", 
                    "label": "Nguồn tìm kiếm", 
                    "type": "select", 
                    "default": "google",
                    "options": [
                        {"label": "Google", "value": "google"},
                        {"label": "Bing", "value": "bing"},
                        {"label": "DuckDuckGo", "value": "duckduckgo"}
                    ]
                }
            ]
        },
        {
            "name": "gmail_search",
            "label": "Tìm kiếm Email nâng cao",
            "description": "Tìm kiếm email bằng query (VD: 'from:boss has:attachment').",
            "icon": "Search",
            "category": "Gmail",
            "supported_params": [
                {
                    "key": "max_results", 
                    "label": "Số lượng email tối đa", 
                    "type": "number", 
                    "default": 10,
                    "desc": "Giới hạn số lượng email trả về trong một lần tìm."
                }
            ]
        },
        {
            "name": "gmail_list",
            "label": "Danh sách thư mới",
            "description": "Tra cứu danh sách các email mới nhất trong hộp thư.",
            "icon": "Mail",
            "category": "Gmail",
            "supported_params": [
                {
                    "key": "max_results", 
                    "label": "Số lượng hiển thị", 
                    "type": "number", 
                    "default": 10
                },
                {
                    "key": "label_ids", 
                    "label": "Nhãn hộp thư", 
                    "type": "text", 
                    "default": "INBOX,UNREAD",
                    "desc": "Ngăn cách bởi dấu phẩy (VD: INBOX,CATEGORY_PROMOTIONS)"
                }
            ]
        },
        {
            "name": "gmail_read",
            "label": "Xem nội dung thư",
            "description": "Đọc nội dung và trích xuất dữ liệu từ một email cụ thể.",
            "icon": "Mail",
            "category": "Gmail"
        },
        {
            "name": "gmail_send",
            "label": "Gửi thư mới",
            "description": "Soạn và gửi email mới với định dạng HTML chuyên nghiệp.",
            "icon": "Send",
            "category": "Gmail"
        },
        {
            "name": "gmail_draft",
            "label": "Quản lý bản nháp",
            "description": "Tạo, sửa hoặc xóa bản nháp để người dùng kiểm duyệt trước khi gửi.",
            "icon": "Edit2",
            "category": "Gmail"
        },
        {
            "name": "gmail_modify",
            "label": "Gắn nhãn & Lưu trữ",
            "description": "Đánh dấu đã đọc, gắn sao, lưu trữ hoặc di chuyển vào thùng rác.",
            "icon": "Layers",
            "category": "Gmail"
        },
        {
            "name": "gmail_reply",
            "label": "Trả lời thư",
            "description": "Phản hồi trực tiếp vào một luồng hội thoại sẵn có.",
            "icon": "RotateCcw",
            "category": "Gmail"
        },
        {
            "name": "text2sql",
            "label": "Truy vấn dữ liệu (Text2SQL)",
            "description": "Hỏi đáp dữ liệu trực tiếp từ các nguồn Database đã kết nối.",
            "icon": "Database",
            "category": "Database",
            "supported_params": [
                {
                    "key": "max_rows", 
                    "label": "Giới hạn dòng kết quả", 
                    "type": "number", 
                    "default": 100,
                    "desc": "Tránh tải quá nhiều dữ liệu gây chậm hệ thống."
                },
                {
                    "key": "table_prefix", 
                    "label": "Tiền tố bảng", 
                    "type": "text", 
                    "default": "",
                    "desc": "Sử dụng khi Database yêu cầu schema (VD: sales_data.)"
                }
            ]
        }
    ]
