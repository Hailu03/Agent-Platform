# CLAUDE.md — WAO AI Agent Platform

> Tài liệu này là **nguồn sự thật duy nhất** cho mọi AI coder làm việc trên dự án WAO AI.  
> Đọc toàn bộ trước khi viết bất kỳ dòng code nào.

---

## 1. Tổng quan dự án

**WAO AI** là một CMS Agent Platform cho phép người dùng — đặc biệt là người dùng low-code / low-tech — xây dựng, quản lý và triển khai AI Agent thông qua giao diện trực quan, thân thiện, không cần lập trình.

### Mục tiêu cốt lõi
- **No-code first**: Mọi tính năng phải có thể dùng được mà không cần viết code.
- **Connector-driven**: Người dùng kết nối các dịch vụ bên ngoài (Google Drive, Slack, v.v.) bằng vài cú click.
- **Tiếng Việt**: Toàn bộ UI, thông báo lỗi, placeholder đều viết bằng tiếng Việt.
- **Trắng + Đen + Xanh lá** là bộ màu chủ đạo, không được tự ý thêm màu mới vào design system.

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                   │
│              Next.js 14+ (App Router)                │
└───────────────────────┬─────────────────────────────┘
                        │ REST / WebSocket
┌───────────────────────▼─────────────────────────────┐
│                  BACKEND (FastAPI)                    │
│        Auth │ Agent CRUD │ Connector Registry         │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────────────────┐
│   Celery    │ │   Redis    │ │   LangGraph Engine    │
│  Workers    │ │  (Multi-   │ │  (Agent Execution)    │
│ (Heavy jobs)│ │  purpose)  │ │   + Langfuse logs     │
└─────────────┘ └────────────┘ └──────────────┬────────┘
                                               │
                              ┌────────────────┴───────┐
                              │     Knowledge Layer     │
                              │  Neo4J (Graph) │ Qdrant │
                              │                │(Vector)│
                              └────────────────────────┘
```

### Luồng dữ liệu tóm tắt
1. User tương tác với Next.js → gọi FastAPI.
2. FastAPI xác thực JWT → giao việc cho Celery nếu nặng, hoặc xử lý trực tiếp.
3. LangGraph nhận task → query Neo4J + Qdrant → trả kết quả.
4. Redis pub/sub đẩy trạng thái real-time về UI qua WebSocket.
5. Langfuse (self-hosted) ghi lại toàn bộ trace của agent.

---

## 3. Stack công nghệ & phiên bản

| Layer | Công nghệ | Ghi chú |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | TypeScript bắt buộc |
| UI Components | shadcn/ui + Tailwind CSS | Custom theme xanh lá |
| Backend | FastAPI (Python 3.11+) | Pydantic v2 |
| Task Queue | Celery 5+ | Broker = Redis |
| Cache/Session/PubSub | Redis 7+ | Xem mục 6 |
| Graph DB | Neo4J 5+ | Knowledge Graph |
| Vector DB | Qdrant | Embedding search |
| AI Agent | LangGraph | Xem mục 9 |
| Observability | Langfuse (self-hosted) | Bắt buộc, không dùng hosted |
| Auth | NextAuth.js / FastAPI OAuth2 | Google + tài khoản thường |
| Container | Docker + Docker Compose | Dev & Prod |

---

## 4. Cấu trúc thư mục

```
wao-ai/
├── frontend/                     # Next.js App
│   ├── app/                      # App Router pages
│   │   ├── (auth)/               # Login, register, verify
│   │   ├── (dashboard)/          # Authenticated area
│   │   │   ├── agents/           # Quản lý Agent
│   │   │   ├── knowledge/        # Knowledge Base
│   │   │   ├── workflows/        # Workflow builder
│   │   │   ├── connectors/       # Kết nối dịch vụ ngoài
│   │   │   └── settings/         # Billing, Preferences
│   │   └── api/                  # Next.js API routes (chỉ dùng cho auth callback)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui base components
│   │   ├── agents/               # Agent-specific components
│   │   ├── chat/                 # Chat UI components
│   │   └── shared/               # Layout, Nav, Sidebar
│   ├── lib/
│   │   ├── api.ts                # API client (fetch wrapper)
│   │   ├── auth.ts               # Auth helpers
│   │   └── utils.ts
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand stores
│   └── types/                    # Shared TypeScript types
│
├── backend/                      # FastAPI App
│   ├── app/
│   │   ├── main.py               # Entry point
│   │   ├── config.py             # Settings (pydantic-settings)
│   │   ├── dependencies.py       # DI: DB sessions, current user, v.v.
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── agents.py
│   │   │   ├── knowledge.py
│   │   │   ├── connectors.py
│   │   │   ├── workflows.py
│   │   │   └── ws.py             # WebSocket endpoints
│   │   ├── models/               # SQLAlchemy models (PostgreSQL)
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic
│   │   │   ├── agent_service.py
│   │   │   ├── connector_service.py
│   │   │   ├── knowledge_service.py
│   │   │   └── auth_service.py
│   │   ├── tasks/                # Celery tasks
│   │   │   ├── embedding.py
│   │   │   ├── agent_run.py
│   │   │   └── indexing.py
│   │   └── core/
│   │       ├── redis.py
│   │       ├── neo4j.py
│   │       ├── qdrant.py
│   │       └── langfuse.py
│   ├── celery_worker.py
│   └── requirements.txt
│
├── agent_engine/                 # LangGraph Agent definitions
│   ├── graphs/                   # LangGraph graph definitions
│   ├── nodes/                    # Individual node functions
│   ├── tools/                    # Tool definitions per connector
│   └── prompts/                  # Prompt templates
│
├── infra/
│   ├── docker-compose.yml        # Dev environment
│   ├── docker-compose.prod.yml
│   └── nginx/
│
└── CLAUDE.md                     ← file này
```

---

## 5. Design System

### Màu sắc

```css
/* Bộ màu WAO AI — KHÔNG được thêm màu ngoài bộ này */
--color-bg:           #FFFFFF;   /* Nền chính */
--color-bg-secondary: #F5F5F5;   /* Nền card, sidebar */
--color-bg-dark:      #0A0A0A;   /* Nền dark mode / header */
--color-text:         #0A0A0A;   /* Chữ chính */
--color-text-muted:   #6B7280;   /* Chữ phụ */
--color-text-inverse: #FFFFFF;   /* Chữ trên nền tối */
--color-primary:      #16A34A;   /* Xanh lá chủ đạo */
--color-primary-dark: #15803D;   /* Hover state */
--color-primary-light:#DCFCE7;   /* Background highlight */
--color-border:       #E5E7EB;   /* Border mặc định */
--color-border-focus: #16A34A;   /* Focus ring */
--color-error:        #DC2626;
--color-warning:      #D97706;
--color-success:      #16A34A;   /* Dùng --color-primary */
```

### Typography
- Font chữ: **Inter** (UI text) + **JetBrains Mono** (code, monospace)
- Tất cả text ngoài code phải dùng Inter.
- Font size scale: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px

### Component Rules
- Tất cả button primary: `bg-green-600 hover:bg-green-700 text-white`
- Border radius chuẩn: `rounded-lg` (8px) cho card, `rounded-md` (6px) cho input
- Không dùng shadow quá nặng — chỉ dùng `shadow-sm` hoặc `shadow-md`
- Icon set: **Lucide React** — không mix icon từ nguồn khác

---

## 6. Redis — Quy ước sử dụng

Redis đảm nhiệm 4 nhiệm vụ khác nhau. Mỗi nhiệm vụ dùng **key prefix riêng** để tránh đụng nhau.

| Mục đích | Prefix | TTL mặc định | Ghi chú |
|---|---|---|---|
| Embedding cache | `emb:` | 7 ngày | Hash nội dung làm key |
| Session memory | `sess:` | 24 giờ | Per user-agent session |
| Rate limiting | `rl:` | 1 phút | Sliding window |
| Pub/Sub channel | `ws:agent:{agent_id}` | N/A | Real-time UI events |

### Ví dụ key
```
emb:sha256:<hash_of_text>
sess:<user_id>:<agent_id>
rl:<user_id>:api
ws:agent:ag_abc123
```

### Pub/Sub event format
```json
{
  "event": "agent_step",
  "agent_id": "ag_abc123",
  "step": "tool_call",
  "data": { "tool": "search_web", "input": "..." },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

## 7. Auth — Quy trình đăng nhập

### Hai luồng đăng ký

**Luồng 1: Đăng ký bằng email/password**
1. User nhập email + password → backend tạo tài khoản, gửi email xác nhận.
2. Sau khi xác nhận email → yêu cầu **liên kết tài khoản Google** (không bắt buộc ngay, nhưng cần để dùng Google connector).
3. Lần đầu dùng Google connector → redirect OAuth Google, lưu refresh token.

**Luồng 2: Đăng nhập bằng Google OAuth**
1. User click "Đăng nhập với Google" → Google OAuth flow.
2. Backend tạo/cập nhật user, lưu Google refresh token vào DB (encrypted).
3. Không cần bước liên kết riêng vì đã có Google token.

### JWT
- Access token: 15 phút, lưu in-memory (không localStorage).
- Refresh token: 7 ngày, HttpOnly cookie.
- Rotation: mỗi lần refresh token được dùng → issue mới, revoke cũ (lưu trong Redis).

### Google token storage
- Google refresh token: mã hóa bằng AES-256 trước khi lưu vào PostgreSQL.
- Không bao giờ log hoặc expose token ra response.

---

## 8. Connector System

Mỗi connector là một plugin độc lập với cấu trúc:

```python
class BaseConnector:
    id: str                    # "google_drive", "slack", "notion", ...
    display_name: str          # "Google Drive"
    description: str
    icon_url: str
    auth_type: Literal["oauth2", "api_key", "webhook"]
    required_scopes: list[str] # OAuth scopes nếu dùng oauth2

    async def connect(self, user_id: str, credentials: dict) -> ConnectorStatus
    async def disconnect(self, user_id: str) -> None
    async def get_tools(self) -> list[LangGraphTool]
    async def health_check(self, user_id: str) -> bool
```

### Danh sách connector ưu tiên (MVP)
1. Google Drive (đọc/tìm file)
2. Google Calendar
3. Gmail
4. Slack
5. Notion
6. Web Search (built-in, không cần auth)
7. HTTP Request (generic webhook)

### Connector UI
- Trang `/connectors` hiển thị tất cả connector dạng grid card.
- Trạng thái: `Chưa kết nối` / `Đã kết nối` / `Lỗi xác thực`.
- Mỗi card có nút "Kết nối" hoặc "Ngắt kết nối".
- Sau khi kết nối, badge xanh lá xuất hiện.

---

## 9. LangGraph Agent Engine

### Graph structure chuẩn

```python
# Mỗi agent có StateGraph riêng
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
import operator

class AgentState(TypedDict):
    messages: Annotated[list, operator.add]
    session_id: str
    user_id: str
    agent_config: dict
    tools_output: list
    iteration: int

def build_agent_graph(agent_config: dict) -> StateGraph:
    graph = StateGraph(AgentState)
    graph.add_node("planner", planner_node)
    graph.add_node("tool_caller", tool_caller_node)
    graph.add_node("responder", responder_node)
    # ... conditional edges
    return graph.compile()
```

### Quy tắc cho nodes
- Mỗi node là một function thuần túy (không có side effects ngoài state).
- Tất cả tool call phải được log vào Langfuse với `trace_id = session_id`.
- Giới hạn iteration mặc định: 10 bước. Config được trong agent settings.
- Khi gọi LLM bên trong node: luôn dùng `langfuse_handler` làm callback.

### Langfuse integration
```python
from langfuse.callback import CallbackHandler

def get_langfuse_handler(session_id: str, user_id: str):
    return CallbackHandler(
        session_id=session_id,
        user_id=user_id,
        tags=["wao-ai", "production"]
    )
```

---

## 10. Knowledge Base

### Neo4J — Knowledge Graph
- Lưu quan hệ giữa các thực thể: Document → Chunk → Entity.
- Query bằng Cypher, không dùng ORM.
- Node labels: `Document`, `Chunk`, `Entity`, `Tag`, `User`, `Agent`.

### Qdrant — Vector Search
- Collection name: `{user_id}_knowledge` (mỗi user có collection riêng).
- Embedding model: `text-embedding-3-small` (OpenAI) hoặc `nomic-embed-text` (local, default nếu không có OpenAI key).
- Distance metric: Cosine.
- Payload luôn có: `{ chunk_id, doc_id, user_id, text_preview, created_at }`.

### Indexing flow (Celery task)
```
Upload file → Extract text → Split chunks → Embed → 
Upsert Qdrant → Extract entities → Update Neo4J graph
```

---

## 11. API Conventions

### Base URL
```
Dev:  http://localhost:8000/api/v1
Prod: https://api.waoai.vn/api/v1
```

### Response format chuẩn
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "total": 42
  }
}
```

### Error format chuẩn
```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Không tìm thấy agent với ID này.",
    "details": {}
  }
}
```

### HTTP Status codes
- `200` OK
- `201` Created
- `400` Bad Request (validation error)
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `422` Unprocessable Entity (Pydantic validation)
- `429` Rate Limit
- `500` Internal Server Error

### Naming conventions
- Endpoints: `kebab-case` → `/api/v1/agent-runs`
- JSON keys: `snake_case`
- Query params: `snake_case`

---

## 12. WebSocket — Real-time UI

### Endpoint
```
ws://localhost:8000/ws/agent/{agent_id}?token={access_token}
```

### Event types từ server → client
```typescript
type WsEvent =
  | { event: "agent_start";    data: { run_id: string } }
  | { event: "agent_step";     data: { step: string; tool?: string; input?: unknown } }
  | { event: "agent_thinking"; data: { content: string } }
  | { event: "agent_output";   data: { content: string; final: boolean } }
  | { event: "agent_error";    data: { code: string; message: string } }
  | { event: "agent_end";      data: { run_id: string; duration_ms: number } }
```

### Frontend WebSocket hook
```typescript
// hooks/useAgentSocket.ts
export function useAgentSocket(agentId: string) {
  // Subscribe to ws:agent:{agentId} via Redis pub/sub → FastAPI → client
  // Expose: { messages, status, send, disconnect }
}
```

---

## 13. Environment Variables

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random_32_chars>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Backend (`.env`)
```bash
# App
APP_ENV=development
SECRET_KEY=<random_64_chars>
ALLOWED_ORIGINS=http://localhost:3000

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/waoai

# Redis
REDIS_URL=redis://localhost:6379/0

# Neo4J
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# AI
OPENAI_API_KEY=
# Nếu dùng local embedding:
OLLAMA_URL=http://localhost:11434

# Langfuse (self-hosted)
LANGFUSE_HOST=http://localhost:3001
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Encryption (cho Google tokens)
ENCRYPTION_KEY=<32_bytes_base64>
```

---

## 14. Quy tắc code

### TypeScript (Frontend)
- **Strict mode** bật (`"strict": true` trong `tsconfig.json`).
- Không dùng `any` — dùng `unknown` rồi narrow type.
- Props của component phải có interface riêng, đặt tên `ComponentNameProps`.
- Server Components là default. Chỉ thêm `"use client"` khi thực sự cần state/event.
- Fetch data ở Server Component, truyền xuống Client Component qua props.
- Zustand chỉ dùng cho UI state global (không phải server state — dùng React Query cho server state).

### Python (Backend)
- Python 3.11+, type hints bắt buộc cho mọi function.
- Async everywhere: dùng `async def` cho tất cả route handlers và service functions.
- Pydantic v2: dùng `model_validator`, `field_validator` thay vì `@validator` cũ.
- Không commit secret vào code. Dùng `config.py` với `pydantic-settings`.
- Exception handling: tạo custom exception classes trong `app/exceptions.py`, handle tập trung ở middleware.

### Naming
| | Frontend (TS) | Backend (Python) |
|---|---|---|
| Files | `kebab-case.ts` | `snake_case.py` |
| Components | `PascalCase` | — |
| Functions | `camelCase` | `snake_case` |
| Constants | `UPPER_SNAKE` | `UPPER_SNAKE` |
| Types/Interfaces | `PascalCase` | `PascalCase` (Pydantic) |

---

## 15. Testing

### Frontend
- **Unit**: Vitest + React Testing Library
- **E2E**: Playwright
- Test files cạnh source: `component.test.tsx`

### Backend
- **Unit + Integration**: Pytest + pytest-asyncio
- **API tests**: HTTPX TestClient
- Fixtures trong `tests/conftest.py`
- Coverage tối thiểu: 70% cho services

### Chạy test
```bash
# Frontend
cd frontend && pnpm test

# Backend
cd backend && pytest tests/ -v --cov=app
```

---

## 16. Docker & Local Dev

### Khởi động môi trường dev
```bash
# Start infrastructure
docker compose up -d postgres redis neo4j qdrant langfuse

# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Celery worker
celery -A celery_worker worker --loglevel=info

# Frontend
cd frontend
pnpm install
pnpm dev
```

### Ports
| Service | Port |
|---|---|
| Next.js | 3000 |
| FastAPI | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Neo4J | 7474 (HTTP), 7687 (Bolt) |
| Qdrant | 6333 |
| Langfuse | 3001 |

---

## 17. Những điều TUYỆT ĐỐI KHÔNG làm

1. **Không lưu secret vào code** — luôn dùng env vars.
2. **Không dùng `localStorage` để lưu access token** — dùng in-memory + HttpOnly cookie.
3. **Không expose Google OAuth token trong API response** — chỉ return status.
4. **Không tự ý thêm màu sắc** ngoài design system đã định nghĩa ở mục 5.
5. **Không viết UI bằng tiếng Anh** — mọi text hiển thị cho user phải bằng tiếng Việt.
6. **Không tạo collection Qdrant chung** cho nhiều user — mỗi user phải có collection riêng.
7. **Không gọi LangGraph trực tiếp từ HTTP request nếu task > 5s** — phải dùng Celery.
8. **Không hardcode model name** — lấy từ agent config, config lấy từ DB.
9. **Không bỏ qua Langfuse** — mọi agent run phải có trace.
10. **Không dùng `console.log` trong production code** — dùng logger có level.

---

## 18. Checklist trước khi tạo Pull Request

- [ ] Tất cả text hiển thị cho user là tiếng Việt
- [ ] Không có `any` type trong TypeScript
- [ ] Không có secret trong code
- [ ] Có unit test cho business logic mới
- [ ] API endpoint mới có Pydantic schema đầy đủ
- [ ] Langfuse trace hoạt động cho agent run mới
- [ ] Không có lỗi TypeScript (`pnpm tsc --noEmit`)
- [ ] Không có lỗi lint (`pnpm lint` và `ruff check .`)
- [ ] Docker compose vẫn khởi động được sau thay đổi
- [ ] UI mới tuân thủ màu sắc và typography đã quy định

---

*Cập nhật lần cuối: 2025 — WAO AI Team*