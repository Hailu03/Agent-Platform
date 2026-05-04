# Product Requirements Document (PRD) - WAO AI Platform

## 1. Tổng quan dự án (Project Overview)
**WAO AI Platform** là một nền tảng SaaS giúp doanh nghiệp và cá nhân xây dựng, quản lý và vận hành các AI Agent thông minh. Nền tảng cho phép người dùng tùy chỉnh tư duy của Agent thông qua hệ thống chỉ dẫn (Instructions), mở rộng kiến thức bằng RAG (Retrieval-Augmented Generation) và tích hợp các công cụ (Tools/Skills) để thực hiện các nhiệm vụ phức tạp.

## 2. Mục tiêu (Goals)
- Cung cấp giao diện trực quan để tạo Agent mà không cần lập trình nhiều.
- Tích hợp đa mô hình ngôn ngữ lớn (LLM) như OpenAI, Claude, Gemini và các mô hình chạy local (Ollama).
- Tối ưu hóa việc quản lý tri thức doanh nghiệp thông qua GraphRAG.
- Cho phép thử nghiệm và tinh chỉnh Agent ngay lập tức trong môi trường giả lập.

## 3. Đối tượng người dùng (Target Audience)
- **Doanh nghiệp**: Cần trợ lý AI chuyên môn cho CSKH, tư vấn bán hàng, phân tích dữ liệu.
- **Nhà phát triển**: Xây dựng các quy trình tự động hóa phức tạp dựa trên AI.
- **Người dùng cá nhân**: Tạo trợ lý học tập hoặc quản lý công việc cá nhân.

## 4. Danh sách chức năng (Functional Requirements)

### 4.1. Dashboard & Quản lý chung
- **Tổng quan**: Hiển thị trạng thái hoạt động của các Agent, số lượng tài liệu đã nạp, và các quy trình đang vận hành.
- **Sidebar điều hướng**: Truy cập nhanh vào các mục: AI Agents, Knowledge, Workflows, Skills, Tools, Connectors.

### 4.2. Quản lý AI Agent
- **Tạo mới/Chỉnh sửa Agent**: Thiết lập tên, mô tả, chuyên môn nghiệp vụ.
- **Cấu hình Model**: 
    - Chọn Provider: OpenAI, Anthropic, Google, Ollama.
    - Chọn phiên bản Model (ví dụ: GPT-4o, Claude 3.5, Gemini 1.5 Pro).
- **Chỉ dẫn hệ thống (Instructions)**: Định nghĩa tính cách, giọng văn và quy tắc hành xử cho Agent.
- **Thử nghiệm (Preview Chat)**: Chat thử nghiệm với Agent với tính năng stream nội dung và hiển thị quá trình "suy nghĩ" (Thinking) của AI.

### 4.3. Quản lý Tri thức (Knowledge Base - RAG)
- **Tải lên tài liệu**: Hỗ trợ các định dạng PDF, TXT...
- **Indexing tự động**: Hệ thống tự động trích xuất văn bản và nạp vào GraphRAG/Vector Database ngay sau khi upload.
- **Theo dõi trạng thái**: Hiển thị trạng thái Indexing (Đang xử lý, Hoàn tất, Lỗi) theo thời gian thực.
- **Cấu hình Embedding**: Cho phép chọn model embedding riêng biệt (OpenAI, Google, Ollama).

### 4.4. Công cụ & Kỹ năng (Tools & Skills)
- **Thư viện công cụ**: 
    - Web Search (SearXNG + BeautifulSoup)
    - Email
    - Code Interpreter
    - Image Generator
    - SQL Executor...
- **Kích hoạt/Hủy kích hoạt**: Bật tắt linh hoạt các công cụ cho từng Agent.
- **Kỹ năng chuyên sâu**: Các module nghiệp vụ được đóng gói sẵn để Agent xử lý các nhiệm vụ đặc thù.

### 4.5. Quy trình & Kết nối (Workflows & Connectors)
- **Workflow**: Thiết kế luồng công việc tự động hóa giữa các Agent và công cụ.
- **Connectors**: Kết nối với các hệ thống bên ngoài như Database (PostgreSQL), Shopify, Google Search API...

### 4.6. Hệ thống Tài khoản & Bảo mật
- **Đăng nhập**: Hỗ trợ Google Login và tài khoản nội bộ.
- **Xác thực**: Sử dụng JWT với cơ chế tự động refresh token để duy trì phiên làm việc.
- **Quản lý API Key**: Mã hóa và lưu trữ an toàn key của các model provider.

## 5. Kiến trúc kỹ thuật (Technical Architecture)
- **Frontend**: Next.js, Tailwind CSS, Lucide icons, Framer Motion.
- **Backend**: FastAPI (Python), SQLAlchemy, Celery (xử lý tác vụ nền).
- **Cơ sở dữ liệu**: PostgreSQL (Relational), Neo4j (Graph), Qdrant (Vector).
- **Lưu trữ**: MinIO (Object Storage).

## 6. Lộ trình phát triển (Roadmap)
- **Giai đoạn 1**: Hoàn thiện tính năng tạo Agent cơ bản và RAG đơn giản.
- **Giai đoạn 2**: Tích hợp GraphRAG nâng cao và hệ thống Workflow trực quan.
- **Giai đoạn 3**: Mở rộng hệ sinh thái Connectors và Marketplace cho Skills.
