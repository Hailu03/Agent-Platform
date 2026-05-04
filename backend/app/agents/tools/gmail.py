import base64
import json
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)

class BaseGmailTool(BaseTool):
    user_tokens: Dict[str, Any] = Field(default_factory=dict)

    async def _get_access_token(self) -> Optional[str]:
        if not self.user_tokens or not self.user_tokens.get("access_token"):
            return None

        access_token = self.user_tokens.get("access_token")
        refresh_token = self.user_tokens.get("refresh_token")
        expiry = self.user_tokens.get("expiry")
        
        is_expired = False
        if expiry:
            if isinstance(expiry, str):
                try:
                    expiry_dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                    is_expired = datetime.now(timezone.utc) > expiry_dt
                except: is_expired = True
            elif isinstance(expiry, datetime):
                is_expired = datetime.now(expiry.tzinfo or timezone.utc) > expiry

        if (not access_token or is_expired) and refresh_token:
            logger.info("🔄 Google Access Token hết hạn, đang tự động làm mới...")
            async with httpx.AsyncClient() as client:
                try:
                    resp = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "client_id": settings.GOOGLE_CLIENT_ID,
                            "client_secret": settings.GOOGLE_CLIENT_SECRET,
                            "refresh_token": refresh_token,
                            "grant_type": "refresh_token",
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data.get("access_token")
                except Exception as e:
                    logger.error(f"Refresh Token Error: {e}")
        
        return access_token

    def _handle_error(self, resp: httpx.Response) -> str:
        try:
            error_msg = resp.json().get("error", {}).get("message", resp.text)
        except:
            error_msg = resp.text

        if resp.status_code == 403:
            if "is not enabled" in error_msg:
                return "❌ Lỗi: Gmail API chưa được kích hoạt trên GCP. Vui lòng Enable Gmail API."
            return f"❌ Lỗi 403: Thiếu quyền truy cập ({error_msg}). Hãy kết nối lại Gmail và tích chọn tất cả các quyền."
        if resp.status_code == 401:
            return "⚠️ Phiên kết nối Google hết hạn. Vui lòng kết nối lại Gmail."
        return f"❌ Lỗi API (Mã: {resp.status_code}): {error_msg}"

    def _create_raw_email(self, to: str, subject: str, body: str) -> str:
        from email.mime.text import MIMEText
        from email.header import Header
        msg = MIMEText(body, 'html', 'utf-8')
        msg['Subject'] = Header(subject, 'utf-8').encode()
        msg['To'] = to
        return base64.urlsafe_b64encode(msg.as_bytes()).decode()

# --- 1. TOOL LIÊT KÊ ---
class GmailListInput(BaseModel):
    max_results: int = Field(10, description="Số lượng email tối đa cần lấy (mặc định 10)")

class GmailListTool(BaseGmailTool):
    name: str = "gmail_list"
    description: str = "Liệt kê danh sách các email chưa đọc gần nhất từ hộp thư Gmail."
    args_schema: type[BaseModel] = GmailListInput

    async def _arun(self, max_results: int = 10):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults={max_results}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code != 200: return self._handle_error(resp)

            messages = resp.json().get("messages", [])
            if not messages: return "📭 Hộp thư không có email chưa đọc."
            
            results = []
            for msg in messages:
                m_resp = await client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}?format=minimal",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if m_resp.status_code == 200:
                    data = m_resp.json()
                    results.append(f"- ID: {msg['id']} | Nội dung: {data.get('snippet', '')}")
            return "\n".join(results) or "📭 Không thể lấy nội dung chi tiết."

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 2. TOOL ĐỌC CHI TIẾT ---
class GmailReadInput(BaseModel):
    email_id: str = Field(..., description="ID của email cần đọc")

class GmailReadTool(BaseGmailTool):
    name: str = "gmail_read"
    description: str = "Đọc nội dung chi tiết của một email cụ thể qua ID."
    args_schema: type[BaseModel] = GmailReadInput

    async def _arun(self, email_id: str):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{email_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code != 200: return self._handle_error(resp)
            data = resp.json()
            return f"Nội dung Email ({email_id}):\n{data.get('snippet', '')}"

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 3. TOOL GỬI MAIL ---
class GmailSendInput(BaseModel):
    to: str = Field(..., description="Địa chỉ email người nhận")
    subject: str = Field(..., description="Tiêu đề email")
    body: str = Field(..., description="Nội dung email (Hỗ trợ định dạng HTML)")

class GmailSendTool(BaseGmailTool):
    name: str = "gmail_send"
    description: str = "Soạn và gửi một email mới. Hỗ trợ định dạng HTML trong tham số 'body'."
    args_schema: type[BaseModel] = GmailSendInput

    async def _arun(self, to: str, subject: str, body: str):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."
        
        encoded_message = self._create_raw_email(to, subject, body)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers={"Authorization": f"Bearer {token}"},
                json={"raw": encoded_message}
            )
            if resp.status_code == 200:
                return f"✅ Đã gửi email thành công tới {to}."
            return self._handle_error(resp)

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 4. TOOL TÌM KIẾM NÂNG CAO ---
class GmailSearchInput(BaseModel):
    query: str = Field(..., description="Chuỗi tìm kiếm theo cú pháp Gmail (VD: 'from:boss has:attachment')")
    max_results: int = Field(10, description="Số lượng kết quả tối đa")

class GmailSearchTool(BaseGmailTool):
    name: str = "gmail_search"
    description: str = "Tìm kiếm email nâng cao bằng query. Hỗ trợ tìm theo người gửi, thời gian, tệp đính kèm..."
    args_schema: type[BaseModel] = GmailSearchInput

    async def _arun(self, query: str, max_results: int = 10):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages",
                params={"q": query, "maxResults": max_results},
                headers={"Authorization": f"Bearer {token}"}
            )
            if resp.status_code != 200: return self._handle_error(resp)
            
            messages = resp.json().get("messages", [])
            if not messages: return f"🔍 Không tìm thấy email nào khớp với: '{query}'"
            
            results = [f"Tìm thấy {len(messages)} kết quả cho '{query}':"]
            for msg in messages:
                m_resp = await client.get(
                    f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg['id']}?format=minimal",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if m_resp.status_code == 200:
                    results.append(f"- ID: {msg['id']} | {m_resp.json().get('snippet')}")
            return "\n".join(results)

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 5. TOOL QUẢN LÝ BẢN NHÁP ---
class GmailDraftInput(BaseModel):
    action: str = Field(..., description="Hành động: 'create', 'list', 'delete'")
    draft_id: Optional[str] = Field(None, description="ID bản nháp (dành cho delete)")
    to: Optional[str] = Field(None, description="Người nhận (dành cho create)")
    subject: Optional[str] = Field(None, description="Tiêu đề (dành cho create)")
    body: Optional[str] = Field(None, description="Nội dung HTML (dành cho create)")

class GmailDraftTool(BaseGmailTool):
    name: str = "gmail_draft"
    description: str = "Quản lý bản nháp (Drafts): Tạo bản nháp mới để người dùng kiểm tra trước khi gửi."
    args_schema: type[BaseModel] = GmailDraftInput

    async def _arun(self, action: str, draft_id: str = None, to: str = None, subject: str = None, body: str = None):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            if action == "create":
                if not to or not body: return "Lỗi: Thiếu 'to' hoặc 'body' để tạo bản nháp."
                raw = self._create_raw_email(to, subject or "No Subject", body)
                resp = await client.post("https://gmail.googleapis.com/gmail/v1/users/me/drafts", headers=headers, json={"message": {"raw": raw}})
                if resp.status_code == 200: return f"✅ Đã tạo bản nháp thành công (ID: {resp.json().get('id')})."
            
            elif action == "list":
                resp = await client.get("https://gmail.googleapis.com/gmail/v1/users/me/drafts", headers=headers)
                if resp.status_code == 200:
                    drafts = resp.json().get("drafts", [])
                    return f"Bạn có {len(drafts)} bản nháp." if drafts else "Hộp thư nháp đang trống."
            
            elif action == "delete":
                if not draft_id: return "Lỗi: Thiếu draft_id"
                resp = await client.delete(f"https://gmail.googleapis.com/gmail/v1/users/me/drafts/{draft_id}", headers=headers)
                if resp.status_code == 204: return f"✅ Đã xóa bản nháp {draft_id}."
            
            return self._handle_error(resp)

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 6. TOOL QUẢN LÝ NHÃN (MODIFIY) ---
class GmailModifyInput(BaseModel):
    email_id: str = Field(..., description="ID của email cần xử lý")
    add_labels: List[str] = Field(default_factory=list, description="Danh sách nhãn muốn thêm (VD: STARRED, TRASH, INBOX)")
    remove_labels: List[str] = Field(default_factory=list, description="Danh sách nhãn muốn xóa (VD: UNREAD)")

class GmailModifyTool(BaseGmailTool):
    name: str = "gmail_modify"
    description: str = "Quản lý nhãn và trạng thái email: Đánh dấu đã đọc, gắn sao, lưu trữ hoặc xóa thư."
    args_schema: type[BaseModel] = GmailModifyInput

    async def _arun(self, email_id: str, add_labels: List[str] = [], remove_labels: List[str] = []):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{email_id}/modify",
                headers={"Authorization": f"Bearer {token}"},
                json={"addLabelIds": add_labels, "removeLabelIds": remove_labels}
            )
            if resp.status_code == 200:
                return f"✅ Đã cập nhật trạng thái cho email {email_id} thành công."
            return self._handle_error(resp)

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")

# --- 7. TOOL TRẢ LỜI THEO LUỒNG (REPLY) ---
class GmailReplyInput(BaseModel):
    thread_id: str = Field(..., description="ID của luồng hội thoại (threadId)")
    body: str = Field(..., description="Nội dung trả lời (Hỗ trợ HTML)")

class GmailReplyTool(BaseGmailTool):
    name: str = "gmail_reply"
    description: str = "Trả lời email theo luồng hội thoại (Thread). Giúp giữ lịch sử trao đổi thay vì gửi thư mới."
    args_schema: type[BaseModel] = GmailReplyInput

    async def _arun(self, thread_id: str, body: str):
        token = await self._get_access_token()
        if not token: return "⚠️ Bạn chưa kết nối Gmail."

        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}"}
            # Lấy thông tin thư cuối cùng trong thread để lấy Subject và To
            t_resp = await client.get(f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{thread_id}", headers=headers)
            if t_resp.status_code != 200: return self._handle_error(t_resp)
            
            thread_data = t_resp.json()
            messages = thread_data.get("messages", [])
            if not messages: return "Lỗi: Luồng hội thoại không tồn tại."
            
            last_msg = messages[-1]
            headers_list = last_msg.get("payload", {}).get("headers", [])
            subject = next((h["value"] for h in headers_list if h["name"].lower() == "subject"), "Re: No Subject")
            if not subject.lower().startswith("re:"): subject = f"Re: {subject}"
            
            # Ở bản đơn giản này, ta gửi tới người gửi của message cuối cùng
            to = next((h["value"] for h in headers_list if h["name"].lower() == "from"), "")

            raw = self._create_raw_email(to, subject, body)
            resp = await client.post(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
                headers=headers,
                json={"raw": raw, "threadId": thread_id}
            )
            if resp.status_code == 200: return f"✅ Đã trả lời vào luồng {thread_id} thành công."
            return self._handle_error(resp)

    def _run(self, *args, **kwargs): raise NotImplementedError("Use _arun")
