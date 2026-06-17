import re
from typing import List, Dict, Any

class BlueprintService:
    """
    Build with AI Engine: Translates natural language descriptions, access scopes,
    autonomy rules, and schedules into structured Agent Blueprints.
    """
    
    @staticmethod
    def compile_blueprint(
        query: str,
        access: List[str] = None,
        autonomy: str = None,
        schedule: str = None,
        current_tools: List[str] = None,
        current_skills: List[str] = None,
        current_instructions: str = None
    ) -> Dict[str, Any]:
        # Clean query
        q_lower = query.lower()
        
        # 1. Automatic Parameter Extraction if not explicitly provided
        if not access:
            access = []
            if any(k in q_lower for k in ["gmail", "email", "thư", "hộp thư", "gửi thư"]):
                access.append("gmail")
            if any(k in q_lower for k in ["facebook", "fanpage", "page", "bình luận", "comment", "tin nhắn"]):
                access.append("facebook")
            if any(k in q_lower for k in ["drive", "google drive", "pdf", "tài liệu", "tri thức", "file"]):
                access.append("drive")
            if any(k in q_lower for k in ["database", "sql", "dữ liệu", "báo cáo", "postgres", "mysql"]):
                access.append("postgres")
                
        if not autonomy:
            if any(k in q_lower for k in ["chỉ đọc", "chỉ xem", "không sửa", "read only", "readonly"]):
                autonomy = "readonly"
            elif any(k in q_lower for k in ["tự động gửi", "tự động phản hồi", "tự động hoàn toàn", "full auto"]):
                autonomy = "full-auto"
            else:
                # Default to highly recommended and safe semi-auto
                autonomy = "semi-auto"
                
        if not schedule:
            if any(k in q_lower for k in ["mỗi sáng", "định kỳ", "mỗi ngày", "hàng ngày", "8h", "8 giờ", "cron", "lập lịch"]):
                schedule = "cron"
            else:
                schedule = "event"
                
        # 2. Generate descriptive name and basic description based on the query
        name = "AI Assistant"
        description = "Trợ lý thông minh tự động cấu hình."
        
        # Smart Naming Rules
        if "gmail" in access:
            name = "Email Operations Assistant"
            description = "Trợ lý hỗ trợ theo dõi, phân loại email và soạn thảo thư trả lời tự động."
        elif "facebook" in access:
            name = "Facebook Page Manager"
            description = "Trợ lý quản lý trang Facebook, trả lời tin nhắn, bình luận và phân tích chỉ số."
        elif "postgres" in access:
            name = "SQL Data Analytics Agent"
            description = "Trợ lý phân tích dữ liệu, tự động truy vấn SQL và lập báo cáo định kỳ."
        elif "drive" in access:
            name = "Document & Research Agent"
            description = "Trợ lý nghiên cứu tài liệu tri thức, tìm kiếm thông tin và giải đáp thắc mắc chuyên nghiệp."
        elif "khách hàng" in q_lower or "customer" in q_lower or "support" in q_lower or "tư vấn" in q_lower:
            name = "Customer Support Agent"
            description = "Trợ lý hỗ trợ khách hàng, phân loại leads và phản hồi thắc mắc."
            
        # 3. Select matching Skills and Tools based on access requests
        skills = []
        tools = []
        permissions = []
        
        # Access mappings
        if "gmail" in access:
            skills.append("Quản lý Gmail")
            tools.extend(["gmail_search", "gmail_read"])
            permissions.append("Đọc Gmail: Được phép")
            permissions.append("Tìm kiếm Gmail: Được phép")
            
            if autonomy == "readonly":
                permissions.append("Gửi/Nháp Gmail: Không được phép (Chỉ đọc)")
            elif autonomy == "semi-auto":
                tools.append("gmail_draft")
                permissions.append("Tạo nháp Gmail: Được phép")
                permissions.append("Gửi Gmail: Bắt buộc duyệt trước khi gửi (HITL)")
            else: # full-auto
                tools.extend(["gmail_draft", "gmail_send"])
                permissions.append("Tạo nháp & Gửi Gmail: Tự động chạy hoàn toàn")
                
        if "facebook" in access:
            skills.append("Chăm sóc Fanpage")
            tools.extend(["facebook_read_messages", "facebook_read_comments"])
            permissions.append("Đọc tin nhắn & Bình luận Page: Được phép")
            
            if autonomy == "readonly":
                permissions.append("Phản hồi Fanpage: Không được phép")
            elif autonomy == "semi-auto":
                tools.extend(["facebook_send_message", "facebook_post_comment"])
                permissions.append("Soạn phản hồi Page: Được phép (Yêu cầu duyệt)")
            else: # full-auto
                tools.extend(["facebook_send_message", "facebook_post_comment", "facebook_create_post"])
                permissions.append("Phản hồi & Đăng bài Fanpage: Tự động hoàn toàn")
                
        if "drive" in access:
            skills.append("Quản lý Tài liệu & Drive")
            tools.append("pdf_reader")
            permissions.append("Đọc tệp tin Drive / PDF: Được phép")
            
        if "postgres" in access:
            skills.append("Phân tích Dữ liệu SQL")
            tools.append("text_to_sql")
            permissions.append("Truy vấn Cơ sở dữ liệu: Được phép (Read-only)")
            
        # Add basic search if appropriate
        if "search" in q_lower or "tìm kiếm web" in q_lower or not tools:
            tools.append("web_search")
            permissions.append("Tìm kiếm Google/Web Search: Được phép")

        # Incremental Merge with pre-existing configuration
        if current_tools:
            tools.extend(current_tools)
        if current_skills:
            skills.extend(current_skills)

        # Deduplicate
        tools = list(set(tools))
        skills = list(set(skills))
        
        # 4. Formulate Automation description
        automation = "Chạy thủ công."
        if schedule == "cron":
            automation = "Chạy tự động định kỳ hàng ngày vào lúc 08:00 sáng."
        elif schedule == "event":
            if "gmail" in access:
                automation = "Kích hoạt lập tức khi phát hiện có email mới gửi tới."
            elif "facebook" in access:
                automation = "Kích hoạt lập tức khi có khách nhắn tin hoặc bình luận."
            else:
                automation = "Kích hoạt theo thời gian thực khi có sự thay đổi dữ liệu."
                
        # 5. Formulate System Prompt
        # Smart prompt merging if existing instructions exist
        is_incremental = False
        if current_instructions and current_instructions.strip():
            is_incremental = any(k in q_lower for k in ["thêm", "bổ sung", "cập nhật", "thêm vào", "add", "update", "extend", "append"])
            
        if is_incremental and current_instructions:
            new_sections = []
            if permissions:
                new_sections.append(f"- Quyền hạn bổ sung: {', '.join(permissions)}")
            new_sections.append(f"- Nhiệm vụ bổ sung mới: Thực hiện theo yêu cầu mới: '{query}'")
            
            system_instructions = (
                f"{current_instructions.rstrip()}\n\n"
                f"# Hướng dẫn bổ sung (Cập nhật tự động theo mô tả mới):\n"
                + "\n".join(new_sections) + "\n"
            )
        else:
            system_instructions = (
                f"Bạn là {name}. Nhiệm vụ của bạn là: {description}\n\n"
                f"Quy tắc hoạt động:\n"
                f"1. Chỉ thực hiện các quyền hạn được phê duyệt trong danh sách: {', '.join(permissions)}\n"
                f"2. Luôn xử lý lịch sự, chính xác và chuyên nghiệp.\n"
            )
            if autonomy == "semi-auto":
                system_instructions += "3. QUAN TRỌNG: Đối với bất kỳ hành động gửi thư hoặc đăng bài nào, bạn phải soạn nháp và yêu cầu người dùng phê duyệt trước khi thực thi thực tế.\n"

        return {
            "name": name,
            "description": description,
            "skills": skills,
            "tools": tools,
            "permissions": permissions,
            "automation": automation,
            "system_instructions": system_instructions
        }
