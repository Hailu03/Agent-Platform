from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.models.base import engine, Base
from .routers import auth, agent, chat, skill, connections, semantic, notifications, guardrails, meta, workflow, mcp
from app.core.logging import setup_logging

# Khởi tạo logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import MCPServer to register on Base.metadata before create_all
    from app.models.mcp import MCPServer
    
    # Tạo bảng nếu chưa tồn tại
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Tự động vá schema cho bảng workflows & conversations nếu thiếu cột (Self-healing migration)
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE workflows ADD COLUMN IF NOT EXISTS cron_expression VARCHAR;"))
            await conn.execute(text("ALTER TABLE workflows ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS mcp_servers JSON DEFAULT '[]';"))
            print("✅ Auto-migration: Added workflows scheduler, conversations is_test, and agents mcp_servers columns if missing.")
    except Exception as e:
        print(f"⚠️ Auto-migration failed: {e}")
        
    # Seeding default skills
    try:
        from app.models.base import AsyncSessionLocal
        from app.models.skill import Skill
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as session:
            # Check if default skills already exist
            result = await session.execute(select(Skill).where(Skill.is_template == True))
            existing_templates = result.scalars().all()
            existing_names = {s.name for s in existing_templates}
            
            default_skills = [
                Skill(
                    id="tpl_facebook_page",
                    name="Chăm sóc Fanpage",
                    description="Kỹ năng chuyên gia quản lý trang Facebook Fanpage, trả lời tin nhắn, bình luận và phân tích chỉ số.",
                    content=(
                        "# Hướng Dẫn Kỹ Năng Chăm Sóc Fanpage Facebook\n\n"
                        "Bạn là chuyên gia chăm sóc và quản lý trang Facebook Fanpage. Hãy tuân thủ nghiêm ngặt các quy tắc sau:\n"
                        "1. Các công cụ Fanpage Facebook sẽ tự động sử dụng trang Fanpage mặc định của người dùng nếu `page_id` bị bỏ trống.\n"
                        "2. KHÔNG hỏi người dùng về `page_id` hoặc `access_token` trừ khi họ muốn ghi đè trang mặc định.\n"
                        "3. Khi muốn gửi tin nhắn cho một khách hàng có tên cụ thể, sử dụng công cụ `facebook_find_contact` hoặc `facebook_send_message(contact_query=...)` thay vì hỏi PSID/recipient_id.\n"
                        "4. Đối với các yêu cầu phân tích/dashboard, ưu tiên sử dụng `facebook_generate_dashboard` để giao diện hiển thị biểu đồ trực quan.\n"
                        "5. Trả lời người dùng dựa trên danh sách các Fanpage khả dụng được cung cấp trong thông tin kết nối hệ thống.\n"
                        "6. Nếu chưa cấu hình Fanpage liên kết, hãy lịch sự hướng dẫn người dùng kết nối trang trên giao diện ứng dụng."
                    ),
                    is_template=True,
                    required_tools=["facebook_read_messages", "facebook_read_comments", "facebook_send_message", "facebook_post_comment", "facebook_create_post", "facebook_dashboard"]
                ),
                Skill(
                    id="tpl_gmail",
                    name="Quản lý Gmail",
                    description="Kỹ năng chuyên gia đọc, lọc, phân loại email và tự động soạn thảo thư trả lời thông minh trên Gmail.",
                    content=(
                        "# Hướng Dẫn Kỹ Năng Quản Lý Gmail\n\n"
                        "Bạn là chuyên gia xử lý email Gmail chuyên nghiệp. Hãy tuân thủ các quy tắc:\n"
                        "1. Ưu tiên tìm kiếm email thông qua `gmail_search` trước khi đọc nội dung đầy đủ bằng `gmail_read`.\n"
                        "2. Khi được yêu cầu soạn email mới, luôn tạo bản nháp bằng `gmail_draft` trước để người dùng kiểm tra.\n"
                        "3. Tùy thuộc vào quyền hạn (Chỉ đọc, Bán tự động, Tự động hoàn toàn) để đưa ra quyết định gửi email trực tiếp hay yêu cầu phê duyệt."
                    ),
                    is_template=True,
                    required_tools=["gmail_search", "gmail_read", "gmail_draft", "gmail_send"]
                ),
                Skill(
                    id="tpl_sql_analytics",
                    name="Phân tích Dữ liệu SQL",
                    description="Tự động biên dịch yêu cầu thành câu lệnh SQL, truy vấn cơ sở dữ liệu Postgres/MySQL và kết xuất dữ liệu báo cáo chuyên sâu.",
                    content=(
                        "# Hướng Dẫn Kỹ Năng Phân Tích Dữ Liệu SQL\n\n"
                        "Bạn là chuyên gia phân tích dữ liệu và thiết kế câu lệnh SQL. Quy tắc hoạt động:\n"
                        "1. Sử dụng công cụ `text_to_sql` để chuyển đổi câu hỏi tự nhiên của người dùng thành truy vấn SQL tương ứng.\n"
                        "2. Luôn giải thích ngắn gọn ý nghĩa của câu truy vấn trước khi chạy và hiển thị kết quả trực quan dạng bảng dữ liệu cho người dùng.\n"
                        "3. Bảo mật: Chỉ thực hiện các câu lệnh SELECT (đọc dữ liệu). Tuyệt đối không chạy các câu lệnh làm thay đổi cấu trúc dữ liệu như INSERT, UPDATE, DELETE, DROP."
                    ),
                    is_template=True,
                    required_tools=["text_to_sql"]
                ),
                Skill(
                    id="tpl_drive",
                    name="Quản lý Tài liệu & Drive",
                    description="Kỹ năng tra cứu, đọc hiểu và tóm tắt thông tin từ kho lưu trữ Google Drive, tài liệu PDF, DOCX nội bộ.",
                    content=(
                        "# Hướng Dẫn Kỹ Năng Quản Lý Tài Liệu & Drive\n\n"
                        "Bạn là chuyên gia tra cứu tri thức nội bộ và phân tích tài liệu. Quy tắc hoạt động:\n"
                        "1. Khi người dùng hỏi về kiến thức hoặc file tài liệu nội bộ, luôn gọi `pdf_reader` hoặc công cụ tìm kiếm tri thức trước tiên.\n"
                        "2. Đọc kĩ và trích xuất thông tin chính xác từ các đoạn tài liệu tìm thấy, luôn dẫn nguồn rõ ràng và không tự bịa đặt thông tin."
                    ),
                    is_template=True,
                    required_tools=["pdf_reader"]
                )
            ]
            
            for ds in default_skills:
                if ds.name not in existing_names:
                    session.add(ds)
                    print(f"🌱 Seeded default skill template: {ds.name}")
            
            await session.commit()
    except Exception as e:
        print(f"⚠️ Seeding default skills failed: {e}")
        
    # Khởi chạy vòng lặp scheduler chạy nền cho workflow cronjobs
    import asyncio
    from app.services.workflows.workflow_scheduler import workflow_cron_scheduler_loop
    scheduler_task = asyncio.create_task(workflow_cron_scheduler_loop())
    
    yield
    
    # Dừng vòng lặp scheduler chạy nền khi tắt app
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
        
    # Dọn dẹp tài nguyên khi tắt/reload
    await engine.dispose()

app = FastAPI(
    title="WAO AI API",
    description="Backend API for WAO AI Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Auth Router
app.include_router(auth.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/api/v1")
app.include_router(skill.router, prefix="/api/v1")
app.include_router(connections.router, prefix="/api/v1")
app.include_router(semantic.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1/chat")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(guardrails.router, prefix="/api/v1")
app.include_router(meta.router, prefix="/api/v1")
app.include_router(workflow.router, prefix="/api/v1")
app.include_router(mcp.router, prefix="/api/v1")

# CORS configuration
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "environment": settings.APP_ENV
        }
    }
