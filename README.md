# 🤖 WAO AI Agent Platform

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/AI_Engine-LangGraph-orange?style=for-the-badge)](https://github.com/langchain-ai/langgraph)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)

**WAO AI Agent Platform** là một giải pháp quản lý và xây dựng AI Agent doanh nghiệp toàn diện. Hệ thống cho phép người dùng thiết kế, huấn luyện và vận hành các trợ lý ảo thông minh với khả năng lập luận chuyên sâu, tích hợp đa mô hình (LLMs) và kết nối dữ liệu nghiệp vụ thực tế.

---

## ✨ Tính năng nổi bật

- 🚀 **Agent Builder**: Giao diện thiết kế Agent trực quan, tùy chỉnh Chuyên môn, Vai trò và Chỉ dẫn hệ thống (System Prompt).
- 🧠 **Hỗ trợ Đa Mô hình (Multi-Provider)**: Tích hợp linh hoạt OpenAI (GPT-4o), Anthropic (Claude 3.5), Google (Gemini) và các mô hình Local qua Ollama (Llama 3, Qwen).
- ⚡ **Real-time Streaming**: Trải nghiệm hội thoại mượt mà với công nghệ Streaming (SSE) và hiển thị tiến trình lập luận (Reasoning/Thinking) theo thời gian thực.
- 📂 **Knowledge Base (RAG)**: Cho phép Agent học hỏi từ các tài liệu doanh nghiệp được tải lên hệ thống.
- 🔐 **Bảo mật doanh nghiệp**: Quản lý API Key riêng biệt cho từng Agent, mã hóa dữ liệu nhạy cảm và xác thực OAuth2/JWT.
- 🎨 **Giao diện Cao cấp**: Thiết kế hiện đại với Dark Mode, Glassmorphism và hiệu ứng mượt mà sử dụng Tailwind CSS & Shadcn UI.

---

## 🛠️ Công nghệ sử dụng

### Frontend
- **Next.js 15 (App Router)**: Framework React mạnh mẽ nhất cho ứng dụng web.
- **Tailwind CSS**: Framework CSS ưu tiên tiện ích.
- **Shadcn UI**: Hệ thống component UI tinh tế và linh hoạt.
- **Lucide Icons**: Bộ icon hiện đại, tối giản.

### Backend
- **FastAPI**: Framework Python hiệu năng cao, hỗ trợ asynchronous hoàn toàn.
- **LangGraph**: Engine quản lý luồng tư duy và trạng thái (Stateful AI) của Agent.
- **SQLAlchemy (Async)**: ORM mạnh mẽ để quản lý cơ sở dữ liệu PostgreSQL.
- **Pydantic**: Xác thực và quản lý schema dữ liệu chặt chẽ.

### Hạ tầng & Lưu trữ
- **PostgreSQL**: Cơ sở dữ liệu quan hệ chính.
- **Redis**: Caching và quản lý session/background jobs.
- **MinIO**: Hệ thống lưu trữ đối tượng (Object Storage) cho tài liệu huấn luyện.
- **Qdrant / Neo4j**: Cơ sở dữ liệu Vector và Graph cho các tính năng RAG nâng cao.
- **Langfuse**: Nền tảng quan sát (Observability) và đánh giá chất lượng AI.

---

## 🚀 Cài đặt nhanh

### 1. Yêu cầu hệ thống
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (cho các dịch vụ hạ tầng)

### 2. Cấu hình Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Hoặc `.venv\Scripts\activate` trên Windows
pip install -r requirements.txt
cp .env.example .env
# Chỉnh sửa thông tin trong .env
python -m uvicorn app.main:app --reload
```

### 3. Cấu hình Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Chỉnh sửa thông tin trong .env.local
npm run dev
```

---

## 📐 Kiến trúc hệ thống

Dự án tuân thủ kiến trúc Micro-services ready:
1. **API Layer**: Tiếp nhận yêu cầu, xác thực và quản lý tài nguyên.
2. **Agent Engine**: Xử lý logic LangGraph, truy vấn LLMs và thực thi công cụ.
3. **Data Layer**: Lưu trữ trạng thái hội thoại, tài liệu và metadata.

---

## 🤝 Đóng góp

Mọi ý kiến đóng góp hoặc báo lỗi vui lòng mở **Issue** hoặc gửi **Pull Request**. Chúng tôi luôn chào đón sự chung tay từ cộng đồng để WAO AI ngày một hoàn thiện hơn.

---

## 📄 Giấy phép

Phát hành dưới giấy phép [MIT](LICENSE). Bản quyền thuộc về **WAO Team**.
