# Product Requirements Document (PRD) - WAO AI Platform

## 1. Tổng quan dự án (Project Overview)
**WAO AI Platform** là một nền tảng SaaS giúp doanh nghiệp và cá nhân xây dựng, quản lý và vận hành các AI Agent thông minh dưới dạng một **Personal AI Workspace** trực quan và an toàn. 

Thay vì bắt người dùng cấu hình kỹ thuật sâu ngay từ đầu, nền tảng chuyển dịch sang mô hình Onboarding hướng sản phẩm: Người dùng chỉ cần mô tả nhu cầu công việc bằng ngôn ngữ tự nhiên, hệ thống tự động lập sơ đồ đề xuất cấu hình (Agent Blueprint) gồm: tên, mô tả, danh mục kỹ năng (Skills), công cụ (Tools), giới hạn phân quyền (Permissions), system prompt và tự động lập lịch hoạt động. Đồng thời, nền tảng tích hợp sẵn hệ thống Workflow tự động hóa trực quan dạng Canvas, hệ thống lưu trữ tri thức GraphRAG, và kiến trúc bảo mật SaaS thắt chặt tối đa.

---

## 2. Mục tiêu (Goals)
- **AI-First Onboarding**: Cung cấp giao diện tạo nhanh bằng ngôn ngữ tự nhiên (Build with AI), biên dịch tiệm tiến (Incremental Compiler) cho phép bổ sung tính năng dễ dàng bằng lời nói mà không đè cấu hình cũ.
- **Advanced Control**: Cung cấp "Chế độ Nâng cao" (Advanced Mode) cho phép tuỳ chỉnh sâu LLM providers, chunking, GraphRAG, và canvas thiết kế.
- **SaaS Security First (P0 Isolation)**: Cách ly tuyệt đối dữ liệu giữa các tenant/user, chạy Code Node của người dùng trong Sandbox an toàn, kiểm duyệt chặt chẽ quyền truy cập storage và API.
- **Workflow & Live Telemetry**: Thiết kế và chạy thử quy trình tự động hóa trực quan, streaming trực tiếp tiến trình và thời gian thực thi của từng node trên Canvas.

---

## 3. Đối tượng người dùng (Target Audience)
- **Người dùng phổ thông (Low-code/No-tech)**: Cần tạo nhanh trợ lý hỗ trợ công việc hàng ngày qua giao diện hội thoại tiếng Việt.
- **Doanh nghiệp & Đội ngũ chuyên môn**: Cần trợ lý AI chuyên môn cao (CSKH, tài chính, nhân sự, kỹ thuật) có kết nối hệ thống dữ liệu doanh nghiệp an toàn.
- **Nhà phát triển (AI Developers)**: Cần thiết kế các luồng tự động hóa phức tạp qua Canvas, viết code node tùy biến và debug trực quan.

---

## 4. Danh sách chức năng (Functional Requirements)

### 4.1. Dashboard & Quản lý chung
- **Tổng quan**: Trạng thái hoạt động của các Agent, tài nguyên tri thức đã tải lên, và lịch sử thực thi quy trình.
- **Đăng ký/Đăng nhập (Auth)**:
  - Đăng nhập tài khoản nội bộ và Google OAuth.
  - Sử dụng cơ chế token kép (Access/Refresh Token) thắt chặt bảo mật.

### 4.2. Quản lý AI Agent & Personal AI Workspace
- **Tạo nhanh bằng AI (Simple Mode)**:
  - Khung chat trung tâm tiếp nhận mô tả nhu cầu công việc của người dùng bằng ngôn ngữ tự nhiên.
  - **AI Blueprint Compiler**: Tự động dịch mô tả thành cấu hình Agent đề xuất.
  - **Blueprint Diff Modal**: So sánh trực quan các thay đổi về Skills, Tools, Permissions, Prompt trước khi xác nhận.
- **Biên dịch tiệm tiến (Incremental Compilation)**:
  - Cho phép người dùng nhập thêm yêu cầu (ví dụ: *"Bổ sung thêm SQL và kết nối database"*) để **thêm** tính năng vào Agent hiện có.
  - Hệ thống tự gộp công cụ/kỹ năng mới với cũ và tự động nối chỉ thị bổ sung vào cuối System Prompt thay vì xóa trắng viết lại.
- **Chế độ Nâng cao (Advanced Mode)**:
  - Tự động kích hoạt khi chỉnh sửa Agent có sẵn cấu hình.
  - Cho phép điều chỉnh sâu: Model Provider (OpenAI, Claude, Gemini, Ollama), instructions hệ thống, liên kết visual Workflow, nạp tệp tri thức và cấu hình embedding.

### 4.3. Quản lý Tri thức (Knowledge Base - RAG)
- **Ingestion Pipeline**: Tải tài liệu (PDF, TXT,...) và theo dõi trạng thái Indexing tự động (pending -> parsing -> chunking -> embedding -> indexed).
- **Phân tách Embedding**: Cấu hình model embedding riêng biệt cho từng nguồn tài liệu.

### 4.4. Công cụ & Kỹ năng (Tools & Skills)
- **Thư viện công cụ phong phú**: Kết nối trực tiếp Gmail (đọc, nháp, gửi, reply), Facebook Fanpage (insight, post, chat), Search, Web Reader và GraphRAG.
- **HITL (Human-In-The-Loop)**: Đánh dấu các tác vụ nhạy cảm (như gửi thư, chuyển khoản, đăng bài) bắt buộc phải tạo trạng thái chờ duyệt và có sự xác nhận của con người trước khi thực thi.

### 4.5. Quy trình & Chạy thử Canvas (Workflows Engine)
- **Workflow Designer**: Giao diện kéo thả Canvas trực quan liên kết các Node (`Start`, `LLM`, `Code`, `Tool`, `Knowledge`, `Answer`, `Condition`).
- **Workflow Selection**: Hỗ trợ liên kết trực tiếp một Workflow quy trình tùy chỉnh vào cấu hình của Agent.
- **Canvas Testing UI & Telemetry**:
  - Tab Chạy thử tích hợp ngay trên Canvas cho phép gửi câu hỏi chạy thử trực tiếp.
  - Stream kết quả thực thi và đo độ trễ (latency ms) của từng node trung gian theo thời gian thực trên Canvas.

---

## 5. Gia cố Bảo mật & Cô lập SaaS (P0 SaaS Security)
Nền tảng được bảo vệ toàn diện qua 6 lớp lá chắn bảo mật nghiêm ngặt:
1. **Token Type Enforcement**: Hàm xác thực JWT từ chối tuyệt đối việc tái sử dụng Refresh Token làm Access Token (bắt buộc kiểm tra `type == "access"`).
2. **CORS Restricted Origins**: Cấu hình CORS chặn tuyệt đối wildcard `*`, chỉ cho phép các domain Frontend được khai báo rõ ràng trong file môi trường truy cập có kèm Credentials.
3. **Database Tenant Isolation**: Thêm cột `user_id` và `workspace_id` vào bảng dữ liệu cơ sở `datasources`. Tất cả các tác vụ CRUD kết nối dữ liệu được lọc chặt chẽ theo tài khoản đang đăng nhập, triệt tiêu rủi ro xem chéo dữ liệu.
4. **Storage Ownership Validation**: Endpoint sinh URL presigned từ MinIO bắt buộc kiểm tra tiền tố đường dẫn `object_name` phải khớp với ID người dùng (`f"{current_user.id}/"`).
5. **Isolated Python Code Sandbox**:
   - Khối chạy Python code của người dùng trên Canvas (`CodeNode`) được cách ly nghiêm ngặt bằng cách thắt chặt `__builtins__` thành whitelist an toàn (chỉ cho phép các phép toán logic, toán học và thư viện xử lý text, chặn hoàn toàn `open`, `__import__`, `eval`, `exec`).
   - Giới hạn thời gian chạy tối đa 3 giây thông qua cơ chế giám sát luồng, tự động ngắt các vòng lặp vô tận gây nghẽn RAM/CPU máy chủ.
6. **ToolExecutionGateway**: Mọi hành động gọi công cụ từ chat hoặc workflow đều đi qua Gateway trung tâm để áp dụng caching, rate limits, audit logs, và cơ chế HITL thống nhất.

---

## 6. Kiến trúc kỹ thuật (Technical Architecture)
- **Frontend**: Next.js 16+ (App Router), React, Tailwind CSS, Framer Motion, Lucide.
- **Backend**: FastAPI (Python 3.11+), Uvicorn, SQLAlchemy (PostgreSQL), Celery.
- **Databases**: PostgreSQL (Relational), Neo4j (Knowledge Graph), Qdrant (Vector).
- **Lưu trữ**: MinIO (Object Storage).

---

## 7. Lộ trình phát triển (Roadmap)
- **Giai đoạn 1**: Hoàn thiện lõi LangGraph, RAG đơn giản và bảo mật SaaS P0.
- **Giai đoạn 2**: Thiết lập Workspace hướng sản phẩm (Simple Mode NLP, Incremental Compiler, Canvas Live Debugger).
- **Giai đoạn 3**: Triển khai Tenant GraphRAG nâng cao, tích hợp Multi-Agent system và tối ưu hóa chi phí token.
