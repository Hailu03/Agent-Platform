# CLAUDE.md — WAO AI Agent Platform Architecture & Guidelines

> Tài liệu này là **nguồn sự thật duy nhất (Single Source of Truth)** cho mọi lập trình viên làm việc trên hệ thống WAO AI.  
> Đọc toàn bộ trước khi bắt đầu viết code hoặc thiết kế hệ thống.

---

## 1. Tổng quan dự án

**WAO AI** là một Personal AI Workspace cho phép người dùng xây dựng, quản lý và triển khai các AI Agent thông minh bằng ngôn ngữ tự nhiên thông qua giao diện trực quan và bộ sinh cấu hình AI Agent Blueprint tự động, tích hợp sẵn hệ thống thiết kế quy trình kéo thả Canvas (Workflows), nạp tài liệu tri thức (RAG) và liên kết các công cụ kết nối nâng cao (Tools/Connectors).

### Mục tiêu cốt lõi
- **AI-Driven & No-code first**: Tạo trợ lý chỉ bằng câu lệnh mô tả (NLP), biên dịch tiệm tiến thông minh (Incremental Compiler).
- **Connector-driven**: Người dùng dễ dàng liên kết các tài khoản cá nhân (Gmail, Facebook, Google Drive) để AI Agent làm việc trực tiếp.
- **SaaS Secure Isolation**: Cách ly dữ liệu nhiều người dùng tuyệt đối, bảo mật sandbox mã nguồn thực thi, và thắt chặt kiểm duyệt HITL (Human-In-The-Loop).
- **Trực quan hóa**: Toàn bộ giao diện được thiết kế hiện đại, hỗ trợ stream kết quả thực thi thời gian thực trên Canvas.
- **Tiếng Việt**: Giao diện và thông báo hệ thống được viết hoàn toàn bằng tiếng Việt thân thiện.

---

## 2. Kiến trúc hệ thống & Lớp bảo mật

```
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                     │
│                Next.js 16+ (Turbopack)                 │
└─────────────────────────┬──────────────────────────────┘
                          │ REST / WebSockets
┌─────────────────────────▼──────────────────────────────┐
│                    BACKEND (FastAPI)                   │
│          Auth & JWT  │  Agent API  │  Workflow API     │
└──────────┬──────────────┬──────────────┬───────────────┘
           │              │              │
           │        ┌─────▼──────────────▼──────┐
           │        │   ToolExecutionGateway    │ <── HITL / Caching
           │        └─────┬──────────────┬──────┘     Rate Limits
           │              │              │
┌──────────▼──┐     ┌─────▼──────┐ ┌─────▼───────────────┐
│   Celery    │     │   Redis    │ │ Isolated Sandbox    │
│  Workers    │     │  (Multi-   │ │ (Whitelisted math/  │ <── Chặn OS/Imports
│ (Heavy jobs)│     │  purpose)  │ │  logical Python)   │     Timeout 3s
└─────────────┘     └────────────┘ └─────────────────────┘
```

### Luồng dữ liệu bảo mật (SaaS Isolation Flow)
1. **JWT Verification**: Hàm `get_current_user` giải mã JWT và yêu cầu nghiêm ngặt `type == "access"`, chặn đứng việc dùng Refresh Token để truy cập API.
2. **Tenant Isolation**: Bảng `datasources` được gán cột `user_id` và `workspace_id`. Mọi truy vấn đọc/ghi thông qua `DataSourceRepository` đều được lọc chặt chẽ theo `current_user.id`.
3. **Storage Security**: Endpoint tạo MinIO Presigned URL xác thực `object_name` phải bắt đầu bằng `f"{current_user.id}/"`, ngăn chặn dòm ngó dữ liệu chéo tài khoản.
4. **Code Execution Sandbox**: Các tác vụ chạy Python động từ `CodeNode` được thực thi dưới môi trường Sandbox whitelisted cực kỳ hạn chế (chặn `open`, `__import__`, `eval`, `exec` và giới hạn thời gian chạy tối đa 3 giây).
5. **ToolExecutionGateway**: Mọi hành động gọi công cụ của Agent (Gmail, Facebook, Search...) từ chat hay workflow đều bắt buộc đi qua cổng kiểm soát tập trung này để áp dụng rate limits, caching, audit logging, và cơ chế kiểm duyệt hành động nhạy cảm của con người (HITL).

---

## 3. Stack công nghệ & phiên bản

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 16.2.4 (Turbopack) | TypeScript, CSS/Shadcn |
| UI Components | shadcn/ui + Framer Motion | Theme tối/sáng và các hiệu ứng gradient |
| Backend | FastAPI (Python 3.11+) | Pydantic v2 |
| Task Queue | Celery 5+ | Broker = Redis |
| Databases | PostgreSQL, Neo4j, Qdrant | Relational, GraphRAG, Vector RAG |
| Flow Orchestrator | LangGraph | Dynamic Node Compilation & Execution |
| Sandboxing | System Trace restricted builtins | Cách ly tài nguyên Python Code |

---

## 4. Cấu trúc thư mục

```
wao-ai/
├── frontend/                     # Next.js App
│   ├── app/                      # App Router pages
│   │   ├── (dashboard)/          # Authenticated area
│   │   │   ├── agents/           # Quản lý Agent & AI Builder
│   │   │   ├── knowledge/        # Quản lý tri thức RAG
│   │   │   └── workflows/        # Thiết kế Workflow Canvas
│   ├── components/
│   │   ├── shared/               # ChatInterface, Sidebar, Nav
│   │   └── ui/                   # Shadcn base components
│   ├── lib/
│   │   └── api.ts                # Dynamic IP rewrite fallback (localhost -> 127.0.0.1)
│
├── backend/                      # FastAPI App
│   ├── app/
│   │   ├── core/
│   │   │   ├── security.py       # Strict JWT check & password hashing
│   │   │   └── gateway.py        # ToolExecutionGateway (HITL & Rate limiting)
│   │   ├── services/
│   │   │   ├── blueprint_service.py # Incremental AI Agent Compiler
│   │   │   └── chat_service.py
│   │   ├── models/               # SQLAlchemy Models (user_id in DataSource)
│   │   ├── repositories/         # DataSourceRepository with user filtering
│   │   ├── agents/               # LangGraph Engine
│   │   │   ├── workflows/        # Module quản lý Workflow kéo thả
│   │   │   │   ├── registry.py   # NodeExecutorRegistry tự động ánh xạ node
│   │   │   │   ├── utils.py      # Tránh circular imports, giải biến State
│   │   │   │   └── nodes/        # Các executors độc lập cho từng loại node
│   │   │   │       ├── start.py
│   │   │   │       ├── llm.py
│   │   │   │       ├── code.py   # Isolated Python sandbox (Timeout 3s)
│   │   │   │       ├── tool.py   # Gọi tool qua ToolExecutionGateway
│   │   │   │       ├── knowledge.py
│   │   │   │       ├── answer.py
│   │   │   │       └── condition.py
│   │   │   └── workflow_executor.py # Lõi biên dịch LangGraph StateGraph
│   │   └── routers/
│   │       ├── agent.py          # /blueprint/compile & CRUD Agent
│   │       └── workflow.py       # /workflows/{id}/run (Live Telemetry Run)
```

---

## 5. Trình Biên dịch Tích lũy (Incremental AI Blueprint Compiler)

Khi người dùng đang cấu hình một Agent và nhập câu lệnh bằng ngôn ngữ tự nhiên để mở rộng (ví dụ: *"Bổ sung thêm SQL và kết nối database"*), trình biên dịch hoạt động theo cơ chế **Incremental**:

- **API Endpoint**: `POST /api/v1/agents/blueprint/compile`
- **Request Body**:
  ```json
  {
    "query": "Bổ sung thêm kỹ năng phân tích dữ liệu SQL và truy vấn database",
    "current_tools": ["gmail_read", "gmail_draft"],
    "current_skills": ["Quản lý Gmail"],
    "current_instructions": "Bạn là trợ lý đắc lực hỗ trợ đọc và lọc email..."
  }
  ```
- **Hợp nhất thông minh**:
  - **Tools & Skills**: Backend tự động gộp danh sách công cụ/kỹ năng cũ và đề xuất mới bằng thuật toán Union: `list(set(new_items + current_items))`.
  - **System Prompt**: Nếu query mang tính chất thêm/bổ sung, Backend giữ nguyên System Prompt cũ và tự động nối thêm phần hướng dẫn hành động & phân quyền mới vào cuối tệp chỉ dẫn dưới thẻ tiêu đề `# Hướng dẫn bổ sung (Cập nhật tự động theo mô tả mới)` thay vì viết lại từ đầu.
  - **Tên & Mô tả**: Frontend giữ nguyên Tên và Mô tả đặt riêng của người dùng, tránh bị AI ghi đè các cấu hình tùy biến.

---

## 6. Thiết kế Quy trình Hướng Registry & Canvas Debugger

### Lớp Executors & Node Registry
Hệ thống Workflow được module hóa hoàn toàn dưới `backend/app/agents/workflows/`:
- **BaseNodeExecutor**: Định nghĩa giao thức chuẩn cho mọi node chạy trong đồ thị LangGraph.
- **NodeExecutorRegistry**: Tự động đăng ký và ánh xạ các loại Node từ JSON Graph sang lớp thực thi cụ thể:
  ```python
  class NodeExecutorRegistry:
      _registry = {}
      
      @classmethod
      def register(cls, node_type: str):
          def decorator(subclass):
              cls._registry[node_type] = subclass
              return subclass
          return decorator
  ```
- **Live Telemetry & Canvas Dry Run**:
  - Endpoint `/api/v1/workflows/{id}/run` sử dụng luồng sự kiện để ghi lại lịch sử thực thi (Trace) của từng node trung gian.
  - Giao diện Canvas trên Frontend tích hợp tab **Chạy thử (Canvas Testing UI)**: Khi kích hoạt, hệ thống stream trực tiếp kết quả chạy thành công/thất bại, JSON biến đầu ra thô, và đo độ trễ (latency ms) của từng node lên giao diện thiết kế theo thời gian thực.

---

## 7. Quy tắc code an toàn & Nghiêm cấm

1. **Nghiêm cấm dùng wildcard `*` trong CORS**: Phải sử dụng danh sách domain hợp lệ `settings.ALLOWED_ORIGINS` (được đọc và tách từ `.env`).
2. **Nghiêm cấm chạy trực tiếp `exec` / `eval` không kiểm soát**: Mọi mã Python động từ Code Node bắt buộc phải chạy thông qua `CodeNodeExecutor` với whitelisted `__builtins__` và cơ chế giám sát ngắt Timeout 3 giây.
3. **Nghiêm cấm gọi trực tiếp Tool không qua Gateway**: Mọi cuộc gọi công cụ nhạy cảm phải đi qua `ToolExecutionGateway` để thực thi HITL, rate limits, và ghi nhật ký hoạt động.
4. **Nghiêm cấm bỏ qua lọc `user_id`**: Mọi bảng dữ liệu liên quan đến dữ liệu người dùng (Data Sources, Agents, Workflows, Knowledge) bắt buộc phải lọc theo `current_user.id` trong repository layer.
5. **Nghiêm cấm dùng Refresh Token làm Access Token**: Route xác thực phải kiểm tra trường `type` trong JWT payload, chỉ chấp nhận token có `type == "access"`.
6. **Xử lý Loopback Failure của Windows**: Frontend fetch wrapper (`lib/api.ts`) bắt buộc tích hợp cơ chế tự động chuyển đổi URL có domain `localhost` sang `127.0.0.1` trên môi trường runtime client để tránh lỗi chặn DNS loopback IPv6 của Windows.

---

*Cập nhật lần cuối: 2026 — WAO AI Team*