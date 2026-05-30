from typing import Any, Dict, Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import decrypt_password
from app.services.facebook_manager import (
    FacebookPageService,
    FacebookSafeResponse,
    MessengerService,
    MetaIdentityResolver,
)
from app.services.meta_graph import MetaGraphClient, MetaGraphError

logger = get_logger(__name__)


class FacebookBaseInput(BaseModel):
    page_id: Optional[str] = Field(None, description="ID Fanpage cần override. Bỏ trống để dùng Fanpage mặc định đã kết nối.")
    access_token: Optional[str] = Field(None, description="Page access token override. Thường bỏ trống vì hệ thống tự dùng token đã kết nối.")


class FacebookPostInput(FacebookBaseInput):
    message: str = Field(description="Nội dung văn bản của bài đăng")
    link: Optional[str] = Field(None, description="Đường dẫn liên kết kèm theo bài đăng")
    image_url: Optional[str] = Field(None, description="URL hình ảnh nếu muốn đăng ảnh")


class FacebookFindContactInput(FacebookBaseInput):
    query: str = Field(description="Tên hoặc từ khóa người cần tìm trong hội thoại/comment, ví dụ 'Ngọc Ngân Trần'")
    limit: int = Field(10, description="Số ứng viên tối đa")


class FacebookMessageInput(FacebookBaseInput):
    message_text: str = Field(description="Nội dung tin nhắn")
    recipient_id: Optional[str] = Field(None, description="PSID nếu đã biết")
    contact_query: Optional[str] = Field(None, description="Tên/ngữ cảnh người nhận nếu chưa biết PSID")


class FacebookListConvsInput(FacebookBaseInput):
    query: Optional[str] = Field(None, description="Lọc hội thoại theo tên hoặc nội dung gần nhất")
    status: Optional[str] = Field(None, description="Dành cho trạng thái nội bộ trong tương lai")
    limit: int = Field(10, description="Số lượng hội thoại")


class FacebookListPostsInput(FacebookBaseInput):
    limit: int = Field(10, description="Số lượng bài viết cần lấy")
    since: Optional[str] = Field(None, description="Ngày bắt đầu YYYY-MM-DD hoặc timestamp Meta chấp nhận")
    until: Optional[str] = Field(None, description="Ngày kết thúc YYYY-MM-DD hoặc timestamp Meta chấp nhận")


class FacebookUnrepliedCommentsInput(FacebookBaseInput):
    post_id: Optional[str] = Field(None, description="ID bài viết cụ thể; bỏ trống để quét các bài gần đây")
    since: Optional[str] = Field(None, description="Ngày bắt đầu YYYY-MM-DD hoặc timestamp Meta chấp nhận")
    limit: int = Field(25, description="Số comment tối đa")


class FacebookCommentReplyInput(FacebookBaseInput):
    comment_id: Optional[str] = Field(None, description="ID comment cần phản hồi")
    target_id: Optional[str] = Field(None, description="Alias cũ cho comment_id")
    message: str = Field(description="Nội dung phản hồi")


class FacebookHideCommentInput(FacebookBaseInput):
    comment_id: str = Field(description="ID comment cần ẩn/hiện")
    hide: bool = Field(True, description="true để ẩn, false để hiện lại")
    reason: Optional[str] = Field(None, description="Lý do nội bộ để audit")


class FacebookInsightsInput(FacebookBaseInput):
    since: Optional[str] = Field(None, description="Ngày bắt đầu")
    until: Optional[str] = Field(None, description="Ngày kết thúc")
    metrics: Optional[list[str]] = Field(None, description="Danh sách metric Meta insights")


class FacebookDashboardInput(FacebookBaseInput):
    since: Optional[str] = Field(None, description="Ngày bắt đầu")
    until: Optional[str] = Field(None, description="Ngày kết thúc")


class FacebookBaseTool(BaseTool):
    page_id: Optional[str] = None
    access_token: Optional[str] = None
    user_facebook_connection: Dict[str, Any] = Field(default_factory=dict)
    human_in_loop: bool = False
    rate_limit: Optional[int] = None
    thread_limit: Optional[int] = None
    run_limit: Optional[int] = None

    def _get_credentials(self, input_page_id: Optional[str] = None, input_token: Optional[str] = None) -> tuple[str, str, str]:
        selected_page_id = self.user_facebook_connection.get("selected_page_id")
        selected_page_token = self.user_facebook_connection.get("selected_page_access_token")
        graph_version = self.user_facebook_connection.get("graph_version") or settings.META_GRAPH_VERSION
        pages = self.user_facebook_connection.get("pages") or []

        page_id = input_page_id or self.page_id or selected_page_id
        access_token = input_token or self.access_token or selected_page_token

        if page_id and not access_token:
            matched_page = next((page for page in pages if page.get("id") == page_id), None)
            if matched_page:
                access_token = matched_page.get("access_token")

        page_id = page_id or ""
        access_token = access_token or ""
        if access_token:
            access_token = decrypt_password(access_token).strip()

        if not page_id or not access_token:
            raise ValueError("Thiếu Page ID hoặc Access Token. Hãy kết nối Facebook và chọn Fanpage mặc định.")
        return page_id, access_token, graph_version

    def _services(self, page_id: Optional[str] = None, access_token: Optional[str] = None) -> tuple[FacebookPageService, MessengerService]:
        pid, token, graph_version = self._get_credentials(page_id, access_token)
        client = MetaGraphClient(token, graph_version=graph_version)
        return FacebookPageService(client, pid), MessengerService(client, pid)

    def _format_error(self, error: Exception) -> str:
        if isinstance(error, MetaGraphError):
            logger.error(
                "Facebook tool MetaGraphError | tool=%s code=%s subcode=%s type=%s action_required=%s retryable=%s message=%s",
                self.name,
                error.code,
                error.subcode,
                error.type,
                error.action_required,
                error.is_retryable,
                error.message,
            )
            if error.action_required == "thread_control":
                return FacebookSafeResponse.error(
                    "Không gửi được vì cuộc hội thoại đang do app khác giữ quyền điều khiển (handover/thread control).",
                    error=error,
                    data={
                        "next_steps": [
                            "Kiểm tra Page đã subscribe app bằng GET /{page_id}/subscribed_apps; nếu data rỗng thì cần cấu hình webhook và subscribe lại Page.",
                            "Nếu Page đã subscribe app, gửi một tin nhắn mới vào Page để mở thread mới hoặc request/take thread control cho thread cũ.",
                            "Nếu thread cũ vẫn bị giữ, cần app đang giữ thread pass_thread_control hoặc dùng Page Inbox xử lý thủ công.",
                        ]
                    },
                )
            if error.action_required == "conversation_routing_not_enabled":
                return FacebookSafeResponse.error(
                    "Không lấy quyền hội thoại được vì Conversation Routing/Handover chưa được bật cho Page/app hiện tại.",
                    error=error,
                    data={
                        "next_steps": [
                            "Cấu hình Callback URL HTTPS và Verify Token trong Messenger API Setup trước.",
                            "Subscribe Page vào app với các fields messages, messaging_postbacks, messaging_handovers.",
                            "Xác nhận bằng GET /{page_id}/subscribed_apps; phải thấy app hiện trong data.",
                            "Sau đó test lại bằng một khách mới nhắn vào Page, rồi mới xử lý thread cũ.",
                        ]
                    },
                )
            if error.action_required == "not_thread_owner":
                return FacebookSafeResponse.error(
                    "App hiện tại chưa phải owner của thread nên không thể pass hoặc thao tác quyền hội thoại.",
                    error=error,
                    data={
                        "next_steps": [
                            "Không gọi pass_thread_control khi app chưa giữ thread.",
                            "Trước hết phải bật routing/subscription và take_thread_control thành công.",
                            "Nếu không take được thread cũ, hãy test bằng hội thoại mới sau khi Page đã subscribe app.",
                        ]
                    },
                )
            if error.action_required == "messaging_window":
                return FacebookSafeResponse.error(
                    "Không gửi được vì hội thoại đã ngoài cửa sổ gửi tin nhắn tiêu chuẩn của Meta.",
                    error=error,
                    data={
                        "next_steps": [
                            "Chờ khách nhắn lại để mở lại cửa sổ phản hồi.",
                            "Hoặc dùng message tag/template hợp lệ theo chính sách Meta.",
                        ]
                    },
                )
            return FacebookSafeResponse.error(error.message, error=error)
        return FacebookSafeResponse.error(str(error))


class FacebookPostTool(FacebookBaseTool):
    name: str = "facebook_post"
    description: str = "Đăng bài viết lên Fanpage Facebook. Cần phê duyệt trước khi thực thi."
    args_schema: Type[BaseModel] = FacebookPostInput
    human_in_loop: bool = True

    async def _arun(self, message: str, link: Optional[str] = None, image_url: Optional[str] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            data = await page_service.create_post(message=message, link=link, image_url=image_url)
            return FacebookSafeResponse.ok("Đã đăng bài thành công.", data=data)
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookFindContactTool(FacebookBaseTool):
    name: str = "facebook_find_contact"
    description: str = "Tìm khách hàng/người dùng theo tên từ Messenger conversations để lấy đúng recipient_id."
    args_schema: Type[BaseModel] = FacebookFindContactInput

    async def _arun(self, query: str, limit: int = 10, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            _, messenger = self._services(page_id, access_token)
            result = await MetaIdentityResolver(messenger).find_contact(query, limit=limit)
            return FacebookSafeResponse.ok("Đã tìm contact.", data=result)
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookMessageSendTool(FacebookBaseTool):
    name: str = "facebook_send_message"
    description: str = "Gửi Messenger bằng recipient_id hoặc tự tìm người nhận qua contact_query. Cần phê duyệt trước khi gửi."
    args_schema: Type[BaseModel] = FacebookMessageInput
    human_in_loop: bool = True

    async def _arun(
        self,
        message_text: str,
        recipient_id: Optional[str] = None,
        contact_query: Optional[str] = None,
        page_id: Optional[str] = None,
        access_token: Optional[str] = None,
    ) -> str:
        try:
            _, messenger = self._services(page_id, access_token)
            resolved = None
            if not recipient_id and contact_query:
                resolved = await MetaIdentityResolver(messenger).find_contact(contact_query, limit=5)
                matched = resolved.get("matched")
                if not matched:
                    return FacebookSafeResponse.ok(
                        "Chưa xác định duy nhất người nhận. Hãy chọn một candidate hoặc cung cấp thêm ngữ cảnh.",
                        data=resolved,
                    )
                recipient_id = matched.get("recipient_id")

            if not recipient_id:
                return FacebookSafeResponse.error("Thiếu recipient_id hoặc contact_query để xác định người nhận.")

            logger.info(
                "facebook_send_message start | page_id=%s recipient_id=%s has_contact_query=%s graph_version=%s",
                page_id or self.page_id or self.user_facebook_connection.get("selected_page_id"),
                recipient_id,
                bool(contact_query),
                self.user_facebook_connection.get("graph_version") or settings.META_GRAPH_VERSION,
            )
            try:
                data = await messenger.send_text(recipient_id=recipient_id, message_text=message_text)
            except MetaGraphError as error:
                if error.action_required == "thread_control":
                    request_result = await messenger.request_thread_control(
                        recipient_id,
                        metadata="OpenClaw agent requested control after send was blocked.",
                    )
                    return FacebookSafeResponse.error(
                        "Chưa gửi được vì thread đang do app/Page Inbox khác giữ quyền. Hệ thống đã gửi request_thread_control tới Meta.",
                        error=error,
                        data={
                            "recipient_id": recipient_id,
                            "resolved": resolved,
                            "request_thread_control": request_result,
                            "next_steps": [
                                "Đừng trả lời thủ công trong Business Suite trước khi agent gửi, vì Page Inbox có thể giữ thread.",
                                "Nhờ khách nhắn lại một tin mới rồi cho agent trả lời ngay.",
                                "Nếu thread vẫn bị chặn, Meta chưa cho app take control vì Conversation Routing không bật cho thread cũ.",
                            ],
                        },
                    )
                raise
            return FacebookSafeResponse.ok("Đã gửi tin nhắn Messenger.", data={"recipient_id": recipient_id, "resolved": resolved, "result": data})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookListConversationsTool(FacebookBaseTool):
    name: str = "facebook_list_conversations"
    description: str = "Lấy danh sách hội thoại Messenger mới nhất và participant để agent hiểu khách đang tương tác."
    args_schema: Type[BaseModel] = FacebookListConvsInput

    async def _arun(self, query: Optional[str] = None, status: Optional[str] = None, limit: int = 10, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            _, messenger = self._services(page_id, access_token)
            conversations = await messenger.list_conversations(limit=limit)
            if query:
                q = query.lower()
                conversations = [
                    item for item in conversations
                    if q in (item.get("participant_name") or "").lower() or q in (item.get("last_message") or "").lower()
                ]
            return FacebookSafeResponse.ok("Đã lấy danh sách hội thoại.", data={"status": status, "conversations": conversations})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookListPostsTool(FacebookBaseTool):
    name: str = "facebook_list_posts"
    description: str = "Đọc các bài viết cũ/gần đây trên Fanpage cùng số comment, reaction và share."
    args_schema: Type[BaseModel] = FacebookListPostsInput

    async def _arun(self, limit: int = 10, since: Optional[str] = None, until: Optional[str] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            posts = await page_service.list_posts(limit=limit, since=since, until=until)
            return FacebookSafeResponse.ok("Đã lấy danh sách bài viết.", data={"posts": posts})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookListUnrepliedCommentsTool(FacebookBaseTool):
    name: str = "facebook_list_unreplied_comments"
    description: str = "Tìm các comment trên Fanpage chưa có reply từ Page để agent xử lý chăm sóc khách hàng."
    args_schema: Type[BaseModel] = FacebookUnrepliedCommentsInput

    async def _arun(self, post_id: Optional[str] = None, since: Optional[str] = None, limit: int = 25, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            comments = await page_service.list_unreplied_comments(post_id=post_id, since=since, limit=limit)
            return FacebookSafeResponse.ok("Đã lấy comment chưa trả lời.", data={"comments": comments})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookCommentReplyTool(FacebookBaseTool):
    name: str = "facebook_reply_comment"
    description: str = "Trả lời comment trên Fanpage. Cần phê duyệt trước khi thực thi."
    args_schema: Type[BaseModel] = FacebookCommentReplyInput
    human_in_loop: bool = True

    async def _arun(self, message: str, comment_id: Optional[str] = None, target_id: Optional[str] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            target = comment_id or target_id
            if not target:
                return FacebookSafeResponse.error("Thiếu comment_id.")
            page_service, _ = self._services(page_id, access_token)
            data = await page_service.reply_comment(target, message)
            return FacebookSafeResponse.ok("Đã phản hồi comment.", data=data)
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookHideCommentTool(FacebookBaseTool):
    name: str = "facebook_hide_comment"
    description: str = "Ẩn hoặc hiện lại comment trên Fanpage. Cần phê duyệt trước khi thực thi."
    args_schema: Type[BaseModel] = FacebookHideCommentInput
    human_in_loop: bool = True

    async def _arun(self, comment_id: str, hide: bool = True, reason: Optional[str] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            data = await page_service.hide_comment(comment_id, hide=hide)
            return FacebookSafeResponse.ok("Đã cập nhật trạng thái comment.", data={"result": data, "reason": reason})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookInsightsTool(FacebookBaseTool):
    name: str = "facebook_get_page_insights"
    description: str = "Lấy insights Fanpage theo metric và khoảng thời gian."
    args_schema: Type[BaseModel] = FacebookInsightsInput

    async def _arun(self, since: Optional[str] = None, until: Optional[str] = None, metrics: Optional[list[str]] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            insights = await page_service.get_insights(metrics=metrics, since=since, until=until)
            return FacebookSafeResponse.ok("Đã lấy Fanpage insights.", data={"insights": insights})
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


class FacebookDashboardTool(FacebookBaseTool):
    name: str = "facebook_generate_dashboard"
    description: str = "Tạo dashboard artifact cho Fanpage: metric grid, biểu đồ insight, top posts, comment chưa trả lời."
    args_schema: Type[BaseModel] = FacebookDashboardInput

    async def _arun(self, since: Optional[str] = None, until: Optional[str] = None, page_id: Optional[str] = None, access_token: Optional[str] = None) -> str:
        try:
            page_service, _ = self._services(page_id, access_token)
            artifacts = await page_service.generate_dashboard(since=since, until=until)
            return FacebookSafeResponse.ok("Đã tạo dashboard Fanpage.", artifacts=artifacts)
        except Exception as e:
            return self._format_error(e)

    def _run(self, *args, **kwargs):
        raise NotImplementedError("Use _arun")


# Backward-compatible alias classes for existing imports/registry names.
FacebookMessageSendLegacyTool = FacebookMessageSendTool
