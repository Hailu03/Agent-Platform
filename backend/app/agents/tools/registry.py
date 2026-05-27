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

from app.agents.tools.facebook import (
    FacebookPostTool, FacebookListPostsTool, FacebookCommentReplyTool,
    FacebookMessageSendTool, FacebookInsightsTool, FacebookListConversationsTool,
    FacebookFindContactTool, FacebookListUnrepliedCommentsTool,
    FacebookHideCommentTool, FacebookDashboardTool
)

def sanitize_tool_name(name: str) -> str:
    """
    Chuyển đổi tên công cụ sang định dạng hợp lệ cho Gemini API:
    - Bắt đầu bằng chữ cái hoặc dấu gạch dưới.
    - Chỉ chứa ký tự chữ cái (không dấu), số, gạch dưới, chấm, hai chấm, gạch ngang.
    - Độ dài tối đa 128.
    """
    # 1. Loại bỏ dấu tiếng Việt
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
    name = re.sub(r'[^a-zA-Z0-9._:-]', '_', name)
    
    # 3. Đảm bảo bắt đầu bằng chữ cái hoặc gạch dưới
    if not re.match(r'^[a-zA-Z_]', name):
        name = 't_' + name
        
    return name[:128]

def get_tools_by_names(tool_configs: List[Any], agent_config: dict = None) -> List[BaseTool]:
    """
    Chuyển đổi danh sách cấu hình tool từ database thành các instance Tool của LangChain.
    """
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
        
        # Facebook Fanpage
        "facebook_post": FacebookPostTool(),
        "facebook_list_posts": FacebookListPostsTool(),
        "facebook_comment_reply": FacebookCommentReplyTool(),
        "facebook_reply_comment": FacebookCommentReplyTool(),
        "facebook_message_send": FacebookMessageSendTool(),
        "facebook_send_message": FacebookMessageSendTool(),
        "facebook_insights": FacebookInsightsTool(),
        "facebook_get_page_insights": FacebookInsightsTool(),
        "facebook_list_conversations": FacebookListConversationsTool(),
        "facebook_find_contact": FacebookFindContactTool(),
        "facebook_list_unreplied_comments": FacebookListUnrepliedCommentsTool(),
        "facebook_hide_comment": FacebookHideCommentTool(),
        "facebook_generate_dashboard": FacebookDashboardTool(),
        
        "Tìm kiếm Web": SearxngSearchTool(), 
        "Gmail": [
            GmailListTool(), GmailReadTool(), GmailSendTool(),
            GmailSearchTool(), GmailDraftTool(), GmailModifyTool(), GmailReplyTool()
        ],
        "Facebook Fanpage Manager": [
            FacebookPostTool(), FacebookListPostsTool(), FacebookCommentReplyTool(),
            FacebookMessageSendTool(), FacebookInsightsTool(), FacebookListConversationsTool(),
            FacebookFindContactTool(), FacebookListUnrepliedCommentsTool(),
            FacebookHideCommentTool(), FacebookDashboardTool()
        ],
    }
    
    tools = []
    for config in tool_configs:
        name = config if isinstance(config, str) else config.get("name")
        is_active = True if isinstance(config, str) else config.get("is_active", True)
            
        if is_active and name in registry:
            t_obj = registry[name]
            
            # Lấy các tham số cấu hình
            fixed_params = {}
            custom_label = None
            custom_desc = None
            
            if not isinstance(config, str):
                custom_label = config.get("label")
                custom_desc = config.get("description")
                fixed_params = config.get("params", {})

            # Xử lý nếu là danh sách tools (nhóm)
            if isinstance(t_obj, list):
                for sub_tool in t_obj:
                    # Inject tham số vào từng tool trong nhóm
                    if fixed_params:
                        for k, v in fixed_params.items():
                            if hasattr(sub_tool, k):
                                try:
                                    current_val = getattr(sub_tool, k)
                                    if isinstance(current_val, int):
                                        object.__setattr__(sub_tool, k, int(v))
                                    else:
                                        object.__setattr__(sub_tool, k, v)
                                except:
                                    object.__setattr__(sub_tool, k, v)
                    
                    # Inject các thuộc tính vận hành (human_in_loop, rate_limit, ...)
                    for attr in ["human_in_loop", "rate_limit", "thread_limit", "run_limit"]:
                        if attr in fixed_params:
                            try:
                                val = fixed_params[attr]
                                if attr == "human_in_loop": val = bool(val)
                                else: val = int(val)
                                object.__setattr__(sub_tool, attr, val)
                            except: pass
                
                tools.extend(t_obj)
            else:
                # Xử lý tool đơn lẻ
                if custom_label:
                    t_obj.name = sanitize_tool_name(custom_label)
                if custom_desc:
                    t_obj.description = custom_desc
                
                if fixed_params:
                    # Gán các thuộc tính đặc biệt
                    for attr in ["human_in_loop", "rate_limit", "thread_limit", "run_limit"]:
                        if attr in fixed_params:
                            try:
                                val = fixed_params[attr]
                                if attr == "human_in_loop": val = bool(val)
                                else: val = int(val)
                                object.__setattr__(t_obj, attr, val)
                            except: pass

                    # Gán các tham số của tool (ví dụ page_id, access_token)
                    for k, v in fixed_params.items():
                        if hasattr(t_obj, k):
                            try:
                                current_val = getattr(t_obj, k)
                                if isinstance(current_val, int):
                                    object.__setattr__(t_obj, k, int(v))
                                else:
                                    object.__setattr__(t_obj, k, v)
                            except:
                                object.__setattr__(t_obj, k, v)
                
                # Wrap tool nếu có tham số (để bảo đảm LangChain nhận diện đúng các thuộc tính đã inject)
                if fixed_params:
                    from langchain_core.tools import Tool
                    
                    original_run = t_obj._run
                    original_arun = t_obj._arun if hasattr(t_obj, "_arun") else None
                    
                    new_tool = Tool(
                        name=t_obj.name,
                        description=t_obj.description,
                        func=original_run,
                        coroutine=original_arun
                    )
                    # Sao chép thuộc tính sang wrapper
                    for attr in ["human_in_loop", "rate_limit", "thread_limit", "run_limit"]:
                        if hasattr(t_obj, attr):
                            object.__setattr__(new_tool, attr, getattr(t_obj, attr))
                    
                    t_obj = new_tool
                
                tools.append(t_obj)
            
    # --- AUTO-INJECTION OF CORE TOOLS ---
    if agent_config and agent_config.get("knowledge_files"):
        if not any(isinstance(t, GraphRAGSearchTool) for t in tools):
            tools.append(GraphRAGSearchTool(agent_config=agent_config))

    if agent_config and agent_config.get("skills"):
        if not any(isinstance(t, SkillLoaderTool) for t in tools):
            tools.append(SkillLoaderTool())

    # --- TỰ ĐỘNG NẠP GMAIL TOKEN ---
    google_tokens = (agent_config or {}).get("user_google_tokens") or {}
    gmail_tool_classes = (GmailListTool, GmailReadTool, GmailSendTool, GmailSearchTool, GmailDraftTool, GmailModifyTool, GmailReplyTool)
    for t in tools:
        if isinstance(t, gmail_tool_classes):
            t.user_tokens = google_tokens

    facebook_connection = (agent_config or {}).get("user_facebook_connection") or {}
    facebook_tool_classes = (
        FacebookPostTool,
        FacebookListPostsTool,
        FacebookCommentReplyTool,
        FacebookMessageSendTool,
        FacebookInsightsTool,
        FacebookListConversationsTool,
        FacebookFindContactTool,
        FacebookListUnrepliedCommentsTool,
        FacebookHideCommentTool,
        FacebookDashboardTool,
    )
    for t in tools:
        if isinstance(t, facebook_tool_classes):
            t.user_facebook_connection = facebook_connection

    # --- KHỬ TRÙNG TOOL THEO TÊN TRƯỚC KHI BIND ---
    # Gemini sẽ reject nếu có duplicate function declaration.
    deduped_tools: List[BaseTool] = []
    seen_names = set()
    for t in tools:
        tool_name = getattr(t, "name", None)
        if not tool_name:
            continue
        if tool_name in seen_names:
            continue
        seen_names.add(tool_name)
        deduped_tools.append(t)

    return deduped_tools

def get_available_tools() -> List[Dict[str, str]]:
    """
    Trả về danh sách metadata của các tool khả dụng để hiển thị trên UI.
    """
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
                }
            ]
        },
        {
            "name": "gmail_list",
            "label": "Danh sách email chưa đọc",
            "description": "Liệt kê nhanh các email chưa đọc gần nhất trong hộp thư Gmail.",
            "icon": "Mail",
            "category": "Gmail"
        },
        {
            "name": "gmail_read",
            "label": "Đọc chi tiết email",
            "description": "Mở và đọc nội dung chi tiết của một email theo ID.",
            "icon": "Eye",
            "category": "Gmail"
        },
        {
            "name": "gmail_send",
            "label": "Gửi email mới",
            "description": "Soạn và gửi email mới từ tài khoản Gmail đã kết nối.",
            "icon": "Send",
            "category": "Gmail"
        },
        {
            "name": "gmail_search",
            "label": "Tìm kiếm Gmail",
            "description": "Tìm email theo cú pháp Gmail như người gửi, tệp đính kèm, thời gian hoặc từ khóa.",
            "icon": "Search",
            "category": "Gmail"
        },
        {
            "name": "gmail_draft",
            "label": "Quản lý bản nháp",
            "description": "Tạo, xem hoặc xóa bản nháp trước khi gửi email thật.",
            "icon": "Edit2",
            "category": "Gmail"
        },
        {
            "name": "gmail_modify",
            "label": "Gắn nhãn và trạng thái",
            "description": "Đánh dấu đã đọc, gắn sao, lưu trữ hoặc thay đổi nhãn email.",
            "icon": "Tag",
            "category": "Gmail"
        },
        {
            "name": "gmail_reply",
            "label": "Trả lời email",
            "description": "Trả lời trực tiếp một email đang có trong hội thoại Gmail.",
            "icon": "Reply",
            "category": "Gmail"
        },
        {
            "name": "text2sql",
            "label": "Truy vấn dữ liệu",
            "description": "Hỏi đáp dữ liệu trực tiếp từ các nguồn Database đã kết nối.",
            "icon": "Database",
            "category": "Database",
            "supported_params": [
                {
                    "key": "max_rows", 
                    "label": "Giới hạn dòng kết quả", 
                    "type": "number", 
                    "default": 100
                }
            ]
        },
        # Facebook Fanpage MVP
        {
            "name": "facebook_find_contact",
            "label": "Tìm khách Facebook",
            "description": "Tìm người nhận theo tên/ngữ cảnh từ Messenger để Agent không phải hỏi PSID.",
            "icon": "Search",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_messaging", "pages_read_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định."}
            ]
        },
        {
            "name": "facebook_post",
            "label": "Đăng bài Facebook",
            "description": "Đăng bài viết mới lên Fanpage Facebook. Mặc định cần phê duyệt.",
            "icon": "Send",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_manage_posts"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định từ Meta connection."}
            ]
        },
        {
            "name": "facebook_list_posts",
            "label": "Đọc bài Fanpage",
            "description": "Đọc bài viết cũ/gần đây cùng số comment, reaction và share.",
            "icon": "FileText",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_read_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định."}
            ]
        },
        {
            "name": "facebook_list_unreplied_comments",
            "label": "Comment chưa trả lời",
            "description": "Tìm comment chưa có phản hồi từ Page để chăm sóc khách.",
            "icon": "Inbox",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_read_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định."}
            ]
        },
        {
            "name": "facebook_reply_comment",
            "label": "Phản hồi bình luận",
            "description": "Trả lời bình luận trên Fanpage. Mặc định cần phê duyệt.",
            "icon": "MessageSquare",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_manage_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định từ Meta connection."}
            ]
        },
        {
            "name": "facebook_hide_comment",
            "label": "Ẩn bình luận",
            "description": "Ẩn hoặc hiện lại comment trên Fanpage. Mặc định cần phê duyệt.",
            "icon": "Eye",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_manage_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định."}
            ]
        },
        {
            "name": "facebook_send_message",
            "label": "Gửi tin Messenger",
            "description": "Gửi Messenger bằng recipient_id hoặc tự tìm người nhận qua tên. Mặc định cần phê duyệt.",
            "icon": "Mail",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_messaging"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định từ Meta connection."}
            ]
        },
        {
            "name": "facebook_list_conversations",
            "label": "Đọc hội thoại",
            "description": "Lấy hội thoại Messenger mới nhất và participant để cá nhân hóa phản hồi.",
            "icon": "Inbox",
            "category": "Facebook Fanpage",
            "required_permissions": ["pages_messaging"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định."}
            ]
        },
        {
            "name": "facebook_get_page_insights",
            "label": "Thống kê Fanpage",
            "description": "Xem báo cáo hiệu quả hoạt động.",
            "icon": "Activity",
            "category": "Facebook Fanpage",
            "required_permissions": ["read_insights", "pages_read_engagement"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định từ Meta connection."}
            ]
        },
        {
            "name": "facebook_generate_dashboard",
            "label": "Dashboard Fanpage",
            "description": "Tạo artifact biểu đồ chuẩn cho độ phủ, tương tác, top post và comment cần xử lý.",
            "icon": "BarChart3",
            "category": "Facebook Fanpage",
            "required_permissions": ["read_insights", "pages_read_engagement", "pages_messaging"],
            "supported_params": [
                {"key": "page_id", "label": "Facebook Page ID", "type": "text", "default": "", "desc": "Không bắt buộc nếu Agent dùng Page mặc định từ Meta connection."}
            ]
        }
    ]
