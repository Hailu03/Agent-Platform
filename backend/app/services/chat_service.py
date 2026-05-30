import json
from datetime import datetime
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.core.redis import redis_cache
from app.models.agent import Agent
from app.models.facebook_connection import FacebookConnection
from app.models.google_tool_connection import GoogleToolConnection
from app.models.skill import Skill
from app.models.user import User
from app.models.guardrails import SystemGuardrails
from typing import Optional
from app.core.config import settings
from app.core.security import decrypt_password
from app.core.logging import get_logger
from app.agents.graph import create_chat_graph
from app.agents.factory import get_embeddings
from app.agents.states.agent_state import Context
from app.repositories.agent_repo import AgentRepository
from sqlalchemy import select, desc
from app.models.conversation import Conversation
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from langgraph.types import Command
from psycopg_pool import AsyncConnectionPool
from contextlib import AsyncExitStack

logger = get_logger(__name__, log_file="logs/chat_service.log")

class ChatService:
    _pool = None
    _store = None

    def __init__(self, agent_repo: AgentRepository):
        self.agent_repo = agent_repo

    @classmethod
    async def get_pool(cls):
        if cls._pool is None:
            logger.info("🗄️ Đang kết nối tới Postgres Pool...")
            # Chuyển đổi định dạng URL của SQLAlchemy sang định dạng chuẩn cho psycopg
            db_url = settings.DATABASE_URL.replace("+asyncpg", "")
            
            cls._pool = AsyncConnectionPool(
                conninfo=db_url,
                max_size=20,
                open=False,
                kwargs={"autocommit": True}
            )
            await cls._pool.open()
            logger.info("✅ Đã kết nối Postgres Pool.")
            
            # --- VÁ SCHEMA TẠI CHỖ (KHÔNG DROP TABLE) ---
            async with cls._pool.connection() as conn:
                async with conn.cursor() as cur:
                    # 1. Kiểm tra bảng checkpoints
                    await cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'checkpoints');")
                    exists = (await cur.fetchone())[0]
                    
                    if exists:
                        logger.info("🛠️ Đang kiểm tra và vá lỗi Schema tại chỗ...")
                        try:
                            # Thêm cột task_path nếu thiếu
                            await cur.execute("ALTER TABLE checkpoint_writes ADD COLUMN IF NOT EXISTS task_path TEXT NOT NULL DEFAULT '';")
                            
                            # Cập nhật Primary Key CHUẨN XÁC theo thư viện
                            await cur.execute("ALTER TABLE checkpoint_writes DROP CONSTRAINT IF EXISTS checkpoint_writes_pkey;")
                            await cur.execute("ALTER TABLE checkpoint_writes ADD PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);")
                            
                            # QUAN TRỌNG: Xóa Index thừa gây lỗi duplicate key
                            await cur.execute("DROP INDEX IF EXISTS checkpoint_writes_upsert_idx;")
                            
                            await conn.commit()
                            logger.info("✅ Vá Schema và dọn dẹp Index thừa thành công.")
                        except Exception as e:
                            logger.warning(f"⚠️ Lưu ý khi vá Schema: {e}")
            
            # 2. Kiểm tra và tạo bảng Store (Luôn kiểm tra và khởi tạo singleton)
            async with cls._pool.connection() as conn:
                cls._store = AsyncPostgresStore(conn)
                await cls._store.setup()
                
            if not exists:
                logger.info("🛠️ Khởi tạo Checkpointer Database mới...")
                import psycopg
                psycopg_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
                async with await psycopg.AsyncConnection.connect(psycopg_url, autocommit=True) as conn:
                    await AsyncPostgresSaver(conn).setup()
                logger.info("✅ Khởi tạo xong.")
        return cls._pool

    async def get_store(self, pool):
        """Trả về đối tượng Store duy nhất của hệ thống"""
        return self.__class__._store

    async def process_chat(self, agent_id: str, user_id: str, message: str, thread_id: str = None, command: dict = None):
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
            raise HTTPException(status_code=404, detail="Agent not found")

        guardrails = await self._get_system_guardrails()
        input_violations = []
        if message and message.strip() and not command:
            input_violations = self._evaluate_input_guardrails(message, guardrails)
        if input_violations:
            action = guardrails.input_action if guardrails else "warn"
            result = {
                "role": "assistant",
                "content": "",
                "guardrails": {
                    "scope": "input",
                    "action": action,
                    "violations": input_violations,
                    "message": None
                }
            }
            if guardrails and guardrails.input_action == "block":
                result["content"] = self._build_input_guardrails_block_message(input_violations)
                result["guardrails"]["message"] = result["content"]
                return result

        # 1. Kiểm tra Cache trước
        cached_res = redis_cache.get_chat_cache(agent_id, user_id, message, agent_db=agent_db, thread_id=thread_id)
        if cached_res:
            return cached_res

        agent_config = await self._get_agent_config(agent_db, current_user_id=user_id)
        pool = await self.get_pool()
        checkpointer = AsyncPostgresSaver(pool)
        store = await self.get_store(pool)
        
        # Load workflow dynamically if set
        has_workflow = False
        if agent_db.workflow_id:
            from app.models.workflow import Workflow
            result = await self.agent_repo.db.execute(select(Workflow).where(Workflow.id == agent_db.workflow_id))
            workflow_db = result.scalar_one_or_none()
            if workflow_db:
                from app.agents.workflow_executor import WorkflowExecutor
                executor = WorkflowExecutor(workflow_db.graph, agent_config)
                graph = executor.app
                has_workflow = True
                
        if not has_workflow:
            graph = create_chat_graph(agent_config, checkpointer=checkpointer, store=store)
        
        # Sử dụng thread_id cụ thể
        final_thread_id = thread_id or f"direct:{user_id}"
        thread_config = {"configurable": {"thread_id": final_thread_id}}
        
        input_state = self._prepare_input_state(agent_id, agent_db, message)
        
        from langgraph.types import Command
        input_data = Command(resume=command) if command else input_state
        
        final_state = await graph.ainvoke(input_data, config=thread_config)
        
        if has_workflow and "final_answer" in final_state:
            content = final_state["final_answer"]
        else:
            ai_message = final_state["messages"][-1]
            content = ai_message.content
            
        result = {"role": "assistant", "content": content}

        violations = self._evaluate_guardrails(ai_message.content or "", guardrails)
        if violations:
            result["guardrails"] = {
                "scope": "output",
                "action": guardrails.action if guardrails else "warn",
                "violations": violations
            }
            if guardrails and guardrails.action == "block":
                result["content"] = self._build_guardrails_block_message(violations)
        
        # 2. Lưu vào Cache
        if message and message.strip():
            redis_cache.set_chat_cache(agent_id, user_id, message, result, agent_db=agent_db, thread_id=thread_id)
        
        return result

    def _format_audit_content(self, obj, event_type=None):
        """Định dạng dữ liệu audit thành chuỗi dễ đọc cho người dùng."""
        if obj is None: return ""
        if isinstance(obj, (str, int, float, bool)): return str(obj)
        
        # 1. Xử lý Tool Start (Args)
        if event_type == "on_tool_start" and isinstance(obj, dict):
            # Trả về các tham số đầu vào của tool dưới dạng dễ đọc
            return f"Tham số: {str(obj)}"

        # 2. Xử lý tin nhắn LangChain (System, Human, AI)
        if hasattr(obj, "type") and getattr(obj, "type") == "system":
            return "" # Ẩn tin nhắn hệ thống khỏi audit log chính
            
        # Lọc các lệnh điều hướng kỹ thuật của LangGraph
        control_flow_terms = ["continue", "go_back", "end", "__end__", "interrupt"]
        
        # Nếu là chuỗi, kiểm tra trực tiếp
        if isinstance(obj, str) and obj.lower() in control_flow_terms:
            return ""
            
        # Nếu là đối tượng tin nhắn, kiểm tra nội dung
        if hasattr(obj, "content"):
            content = obj.content
            if isinstance(content, str) and content.lower() in control_flow_terms:
                return ""
            if isinstance(content, list):
                parts = []
                for p in content:
                    if isinstance(p, dict) and p.get("type") == "text":
                        parts.append(p.get("text", ""))
                    elif isinstance(p, str):
                        parts.append(p)
                return "".join(parts).strip()
            return str(content)

        # 3. Xử lý kết quả tìm kiếm (Danh sách các dict)
        if isinstance(obj, list) and len(obj) > 0 and isinstance(obj[0], dict) and "title" in obj[0]:
            formatted = []
            for item in obj:
                title = item.get("title", "Nguồn")
                link = item.get("link", "")
                snippet = item.get("snippet", item.get("content", ""))
                formatted.append(f"Tiêu đề: {title}\nLink: {link}\nNội dung: {snippet}\n---")
            return "\n".join(formatted)

        # 4. Xử lý State của LangGraph (Dict chứa 'messages')
        if isinstance(obj, dict) and "messages" in obj:
            msgs = obj["messages"]
            if msgs: return self._format_audit_content(msgs[-1])
            return ""

        # 5. Xử lý kết quả công cụ (summarized_content)
        if isinstance(obj, dict):
            if "summarized_content" in obj: return str(obj["summarized_content"])
            if "content" in obj: return self._format_audit_content(obj["content"])
            # Nếu là kết quả kỹ năng load_skill
            if "skill_name" in obj: return f"Kỹ năng: {obj['skill_name']}"
            # Trả về chuỗi JSON nếu là dict không xác định để tránh mất thông tin
            val = json.dumps(obj, ensure_ascii=False)
            # Lọc nếu JSON chứa các từ khóa kỹ thuật thuần túy
            if val.lower() in ['"continue"', '"go_back"', '"end"', '"interrupt"']:
                return ""
            return val

    def _json_serializable(self, obj):
        """Chuyển đổi các đối tượng không serializable (như LangChain Messages) sang dict/list/string."""
        if obj is None:
            return None
        if isinstance(obj, (str, int, float, bool)):
            return obj
        if hasattr(obj, "dict") and callable(obj.dict):
            return obj.dict()
        if hasattr(obj, "to_json") and callable(obj.to_json):
            return obj.to_json()
        if isinstance(obj, list):
            return [self._json_serializable(item) for item in obj]
        if isinstance(obj, dict):
            return {k: self._json_serializable(v) for k, v in obj.items()}
        return str(obj)

    async def _get_system_guardrails(self):
        result = await self.agent_repo.db.execute(select(SystemGuardrails).limit(1))
        return result.scalars().first()

    def _build_guardrails_instructions(self, guardrails: Optional[SystemGuardrails]) -> str:
        if not guardrails or not guardrails.enabled:
            return ""

        lines = ["\n### GUARDRAILS (SYSTEM)"]

        if guardrails.policy_text:
            lines.append(guardrails.policy_text.strip())

        if guardrails.prohibited_terms:
            terms = ", ".join(t for t in guardrails.prohibited_terms if t)
            if terms:
                lines.append(f"Prohibited terms: {terms}")

        if guardrails.required_phrases:
            phrases = ", ".join(p for p in guardrails.required_phrases if p)
            if phrases:
                lines.append(f"Required phrases: {phrases}")

        if guardrails.max_output_chars:
            lines.append(f"Max output length: {guardrails.max_output_chars} characters")

        lines.append("If the user request or your draft violates guardrails, ask for clarification or refuse per policy.")
        return "\n".join(lines) + "\n"

    def _evaluate_guardrails(self, content: str, guardrails: Optional[SystemGuardrails]) -> list[dict]:
        if not guardrails or not guardrails.enabled:
            return []

        violations: list[dict] = []
        text = content or ""
        lowered = text.lower()

        if guardrails.max_output_chars and len(text) > guardrails.max_output_chars:
            violations.append({
                "type": "max_output_chars",
                "limit": guardrails.max_output_chars,
                "actual": len(text)
            })

        if guardrails.prohibited_terms:
            matched = [term for term in guardrails.prohibited_terms if term and term.lower() in lowered]
            if matched:
                violations.append({
                    "type": "prohibited_terms",
                    "terms": matched
                })

        if guardrails.required_phrases:
            missing = [phrase for phrase in guardrails.required_phrases if phrase and phrase.lower() not in lowered]
            if missing:
                violations.append({
                    "type": "required_phrases",
                    "missing": missing
                })

        return violations

    def _build_guardrails_block_message(self, violations: list[dict]) -> str:
        details = []
        for violation in violations:
            v_type = violation.get("type")
            if v_type == "max_output_chars":
                details.append(f"Vượt giới hạn ký tự (tối đa {violation.get('limit')}).")
            elif v_type == "prohibited_terms":
                terms = ", ".join(violation.get("terms", []))
                details.append(f"Chứa từ/chuỗi bị cấm: {terms}.")
            elif v_type == "required_phrases":
                missing = ", ".join(violation.get("missing", []))
                details.append(f"Thiếu cụm bắt buộc: {missing}.")

        suffix = " ".join(details).strip()
        message = "Output bị chặn bởi Guardrails. Vui lòng chỉnh sửa yêu cầu hoặc bổ sung thông tin."
        if suffix:
            message = f"{message} Ly do: {suffix}"
        return message

    def _evaluate_input_guardrails(self, content: str, guardrails: Optional[SystemGuardrails]) -> list[dict]:
        if not guardrails or not guardrails.enabled:
            return []

        violations: list[dict] = []
        text = content or ""
        lowered = text.lower()

        if guardrails.max_input_chars and len(text) > guardrails.max_input_chars:
            violations.append({
                "type": "max_input_chars",
                "limit": guardrails.max_input_chars,
                "actual": len(text)
            })

        if guardrails.input_prohibited_terms:
            matched = [term for term in guardrails.input_prohibited_terms if term and term.lower() in lowered]
            if matched:
                violations.append({
                    "type": "input_prohibited_terms",
                    "terms": matched
                })

        if guardrails.input_required_phrases:
            missing = [phrase for phrase in guardrails.input_required_phrases if phrase and phrase.lower() not in lowered]
            if missing:
                violations.append({
                    "type": "input_required_phrases",
                    "missing": missing
                })

        return violations

    def _build_input_guardrails_block_message(self, violations: list[dict]) -> str:
        details = []
        for violation in violations:
            v_type = violation.get("type")
            if v_type == "max_input_chars":
                details.append(f"Vượt giới hạn ký tự đầu vào (tối đa {violation.get('limit')}).")
            elif v_type == "input_prohibited_terms":
                terms = ", ".join(violation.get("terms", []))
                details.append(f"Chứa từ/chuỗi bị cấm: {terms}.")
            elif v_type == "input_required_phrases":
                missing = ", ".join(violation.get("missing", []))
                details.append(f"Thiếu cụm bắt buộc: {missing}.")

        suffix = " ".join(details).strip()
        message = "Yêu cầu đầu vào bị chặn bởi Guardrails. Vui lòng điều chỉnh nội dung và thử lại."
        if suffix:
            message = f"{message} Ly do: {suffix}"
        return message

    async def stream_chat(self, agent_id: str, user_id: str, message: str, thread_id: str = None, command: dict = None) -> StreamingResponse:
        """
        API chính để chat với luồng dữ liệu (SSE) + Thread Isolation
        """
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
             async def error_gen():
                 yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
             return StreamingResponse(error_gen(), media_type="text/event-stream")

        # 1. Thread Management
        is_new_thread = False
        if not thread_id and not command:
            import uuid
            thread_id = str(uuid.uuid4())
            is_new_thread = True
            logger.info(f"🆕 Tạo Thread mới: {thread_id}")

        # 2. Kiểm tra Semantic Cache
        cached_res = None
        cache_ref_text = ""
        if message and message.strip():
            cached_res = redis_cache.get_chat_cache(agent_id, user_id, message, agent_db=agent_db, thread_id=thread_id)
            if cached_res:
                logger.info(f"💡 Tìm thấy nhật ký tư duy cũ cho Thread {thread_id}")
                old_thinking = cached_res.get("thinking", "Không có dữ liệu tư duy.")
                old_content = cached_res.get("content", "")
                cache_ref_text = f"--- NHẬT KÝ TƯ DUY CŨ ---\n{old_thinking}\n\n--- KẾT QUẢ CŨ ---\n{old_content}"

        async def event_generator(): 
            agent_config = await self._get_agent_config(agent_db, current_user_id=user_id)
            guardrails = await self._get_system_guardrails()

            input_violations = []
            if message and message.strip() and not command:
                input_violations = self._evaluate_input_guardrails(message, guardrails)

            if input_violations:
                action = guardrails.input_action if guardrails else "warn"
                guardrails_message = None
                if guardrails and guardrails.input_action == "block":
                    guardrails_message = self._build_input_guardrails_block_message(input_violations)

                yield f"data: {json.dumps({'guardrails': {'scope': 'input', 'action': action, 'violations': input_violations, 'message': guardrails_message}})}\n\n"

                if guardrails and guardrails.input_action == "block":
                    yield "data: [DONE]\n\n"
                    return
            
            # Hàm custom embed dùng cấu hình của Agent
            async def custom_embed(texts: list[str]) -> list[list[float]]:
                # Giải mã key
                emb_key = decrypt_password(agent_db.embedding_api_key) if agent_db.embedding_api_key else None
                emb = get_embeddings(
                    provider=agent_db.embedding_provider,
                    model=agent_db.embedding_model,
                    api_key=emb_key
                )
                return await emb.aembed_documents(texts)
            
            # Tối ưu: Lấy số chiều từ Cache theo Provider + Model
            cache_key_dims = f"emb_dims:{agent_db.embedding_provider}:{agent_db.embedding_model}"
            cached_dims = redis_cache.redis.get(cache_key_dims)
            
            if cached_dims:
                actual_dims = int(cached_dims)
                logger.info(f"🚀 Reused embedding dimensions from cache: {actual_dims} for {agent_db.embedding_provider}/{agent_db.embedding_model}")
            else:
                # Nếu chưa có trong cache, mới thực hiện embed thử 1 lần
                logger.info(f"🔍 Detecting embedding dimensions for {agent_db.embedding_model}...")
                sample_emb = await custom_embed(["test"])
                actual_dims = len(sample_emb[0])
                # Lưu vào cache 24h (86400s)
                redis_cache.redis.set(cache_key_dims, actual_dims, ex=86400)
                logger.info(f"💾 Cached embedding dimensions: {actual_dims} for {agent_db.embedding_model}")

            # Khởi tạo Postgres Checkpointer & Store (Sử dụng context manager để tránh leak tasks)
            pool = await self.get_pool()
            
            async with AsyncExitStack() as stack:
                # 1. Setup Checkpointer
                checkpointer = AsyncPostgresSaver(pool)
                
                # 2. Setup Store
                store = AsyncPostgresStore(
                    pool,
                    index={
                        "embed": custom_embed,
                        "dims": actual_dims
                    }
                )
                await stack.enter_async_context(store)
                
                logger.info("⚙️ Đang khởi tạo Graph...")
                has_workflow = False
                if agent_db.workflow_id:
                    from app.models.workflow import Workflow
                    result = await self.agent_repo.db.execute(select(Workflow).where(Workflow.id == agent_db.workflow_id))
                    workflow_db = result.scalar_one_or_none()
                    if workflow_db:
                        from app.agents.workflow_executor import WorkflowExecutor
                        executor = WorkflowExecutor(workflow_db.graph, agent_config)
                        graph = executor.app
                        has_workflow = True
                        
                if not has_workflow:
                    graph = create_chat_graph(agent_config, checkpointer=checkpointer, store=store)
                
                # Metadata isolation
                thread_config = {
                    "configurable": {"thread_id": thread_id},
                    "recursion_limit": 60
                }
                
                # --- LƯU CONVERSATION NẾU LÀ MỚI ---
                if is_new_thread:
                    # Tiêu đề mặc định lấy từ câu đầu tiên (không dùng AI)
                    raw_title = (message or "").strip()
                    temp_title = raw_title[:80] if raw_title else "Cuộc trò chuyện"
                    new_conv = Conversation(
                        user_id=user_id,
                        agent_id=agent_id,
                        thread_id=thread_id,
                        title=temp_title,
                        message=message,
                        role="user"
                    )
                    self.agent_repo.db.add(new_conv)
                    await self.agent_repo.db.commit()
                    # Gửi thread_id và tiêu đề tạm về UI
                    yield f"data: {json.dumps({'thread_id': thread_id, 'title': temp_title})}\n\n"
                
                input_state = self._prepare_input_state(agent_id, agent_config["instructions"], message, cache_reference=cache_ref_text)
            
                logger.info(f"🟢 Bắt đầu Stream cho User {user_id}...")
                full_content = ""
                full_thinking = ""
                audit_log = []
                last_metrics = None
                artifacts = []
                in_thinking_mode = False # Trạng thái tư duy cục bộ cho mỗi stream
                last_part_was_structured = False # Theo dõi nếu part trước đó là structured thinking
                current_node = None # Theo dõi node hiện tại để phân tách thinking

                try:
                    context_obj = Context(user_id=user_id, agent_id=agent_id)
                    
                    # Nếu có command, thực hiện resume thay vì truyền input_state mới
                    input_data = Command(resume=command) if command else input_state
                    
                    # Theo dõi run_id cho mỗi node để tránh trùng lặp
                    active_stream_run: dict[str, str] = {}
                    skipped_run_ids: set = set()
                    
                    async for event in graph.astream_events(
                        input_data, 
                        config=thread_config, 
                        version="v2",
                        context=context_obj
                    ):
                        kind = event.get("event")
                        node_name = event.get("metadata", {}).get("langgraph_node", "")
                        
                        if kind == "on_chat_model_stream":
                            # --- DEDUP: Lọc events trùng lặp từ bind_tools ---
                            run_id = event.get("run_id", "")
                            
                            if run_id in skipped_run_ids:
                                continue

                            # Tách biệt thinking giữa các node khác nhau
                            if node_name != current_node and full_thinking:
                                separator = "\n\n---\n\n"
                                full_thinking += separator
                                yield f"data: {json.dumps({'thinking': separator})}\n\n"
                            current_node = node_name
                            
                            if node_name in active_stream_run:
                                if active_stream_run[node_name] != run_id:
                                    skipped_run_ids.add(run_id)
                                    continue
                            else:
                                active_stream_run[node_name] = run_id
                            
                            # Chỉ lấy content từ node chính (agent) hoặc answer node trong workflow
                            is_output_node = node_name in ["agent"] or (has_workflow and "answer" in node_name)
                            
                            chunk = event["data"]["chunk"]
                            content = chunk.content
                            thinking_metadata = ""
                            
                            # 1. Trích xuất thinking từ metadata (nếu có)
                            if hasattr(chunk, "additional_kwargs"):
                                thinking_metadata = (
                                    chunk.additional_kwargs.get("thinking", "") or 
                                    chunk.additional_kwargs.get("thought", "") or
                                    chunk.additional_kwargs.get("reasoning", "") or
                                    chunk.additional_kwargs.get("reasoning_content", "")
                                )
                            
                            # 2. Xử lý node đặc biệt (summarizer)
                            if node_name == "summarizer":
                                if content:
                                    thinking_metadata += str(content)
                                content = ""

                            # --- 3. XỬ LÝ CONTENT (CHÍNH) ---
                            # Chuyển đổi content về dạng list các part để xử lý thống nhất
                            parts_to_process = content if isinstance(content, list) else ([content] if content else [])
                            
                            # Nếu có thinking từ metadata, xử lý trước
                            if thinking_metadata:
                                if not full_thinking and not full_content:
                                    yield f"data: {json.dumps({'status': '🧠 Đang suy nghĩ...'})}\n\n"
                                full_thinking += str(thinking_metadata)
                                yield f"data: {json.dumps({'thinking': str(thinking_metadata)})}\n\n"
                                in_thinking_mode = True

                            for part in parts_to_process:
                                p_text = ""
                                is_structured_thinking = False
                                
                                if isinstance(part, dict):
                                    p_type = part.get("type", "")
                                    if p_type in ["thinking", "thought", "reasoning", "reasoning_content"]:
                                        p_text = (
                                            part.get("thinking") or 
                                            part.get("thought") or 
                                            part.get("reasoning") or 
                                            part.get("reasoning_content") or 
                                            part.get("text", "")
                                        )
                                        is_structured_thinking = True
                                    else:
                                        p_text = part.get("text", "") or str(part)
                                else:
                                    p_text = str(part)
                                
                                if not p_text:
                                    continue

                                if is_structured_thinking:
                                    if not full_thinking and not full_content:
                                        yield f"data: {json.dumps({'status': '🧠 Đang suy nghĩ...'})}\n\n"
                                    full_thinking += p_text
                                    yield f"data: {json.dumps({'thinking': p_text})}\n\n"
                                    in_thinking_mode = True 
                                    # Ta đánh dấu đây là structured để part tiếp theo có thể reset
                                    last_part_was_structured = True
                                else:
                                    # Xử lý phần text có thể chứa thẻ <thinking> XML
                                    start_tags = ["<thinking>", "<thought>", "<reasoning>"]
                                    end_tags = ["</thinking>", "</thought>", "</reasoning>"]
                                    
                                    found_start_tag = next((tag for tag in start_tags if tag in p_text), None)
                                    
                                    # Nếu trước đó là structured và part này không có tag mở, ta thoát mode để vào content
                                    if last_part_was_structured and not found_start_tag:
                                        in_thinking_mode = False
                                    
                                    last_part_was_structured = False

                                    if in_thinking_mode or found_start_tag:
                                        process_text = p_text
                                        
                                        # Nếu vừa tìm thấy tag mở, cắt bỏ phần trước tag và bắt đầu thinking
                                        if found_start_tag and not in_thinking_mode:
                                            parts = process_text.split(found_start_tag, 1)
                                            before_tag = parts[0]
                                            if before_tag and is_output_node:
                                                full_content += before_tag
                                                yield f"data: {json.dumps({'content': before_tag})}\n\n"
                                            
                                            in_thinking_mode = True
                                            process_text = parts[1] if len(parts) > 1 else ""

                                        # Trong khi đang thinking, tìm tag đóng
                                        if in_thinking_mode:
                                            found_end_tag = next((tag for tag in end_tags if tag in process_text), None)
                                            if found_end_tag:
                                                parts = process_text.split(found_end_tag, 1)
                                                thinking_part = parts[0]
                                                if thinking_part:
                                                    full_thinking += thinking_part
                                                    yield f"data: {json.dumps({'thinking': thinking_part})}\n\n"
                                                
                                                in_thinking_mode = False
                                                after_tag = parts[1] if len(parts) > 1 else ""
                                                if after_tag and is_output_node:
                                                    full_content += after_tag
                                                    yield f"data: {json.dumps({'content': after_tag})}\n\n"
                                            else:
                                                # Vẫn đang trong mode thinking
                                                if process_text:
                                                    full_thinking += process_text
                                                    yield f"data: {json.dumps({'thinking': process_text})}\n\n"
                                    else:
                                        # Nội dung thông thường
                                        if is_output_node:
                                            if not full_content:
                                                yield f"data: {json.dumps({'status': '✍️ Đang trả lời...'})}\n\n"
                                            full_content += p_text
                                            yield f"data: {json.dumps({'content': p_text})}\n\n"
                                        else:
                                            # Nếu không phải node chính mà có text, mặc định coi là thinking
                                            if p_text.strip():
                                                full_thinking += p_text
                                                yield f"data: {json.dumps({'thinking': p_text})}\n\n"


                        
                        # 4. THU THẬP AUDIT LOG (Đã làm sạch)
                        technical_nodes = ["_after_tool_check", "__start__", "__end__", "chain stream", "memorize"]
                        
                        if kind in ["on_chain_start", "on_chain_end", "on_chat_model_end", "on_tool_start", "on_tool_end"]:
                            name = event.get("name", "Chain")
                            node_map = {
                                "agent": "Suy nghĩ",
                                "web_search": "Tìm kiếm Web",
                                "Tim_kiem_Web": "Tìm kiếm Web",
                                "load_skill": "Nạp Kỹ năng",
                                "tools": "Sử dụng Công cụ",
                                "__start__": "Đầu vào",
                                "LangGraph": "Quy trình Tổng thể"
                            }
                            node_key = node_map.get(node_name or name, node_name or name)
                            
                            # Logic lọc nâng cao để tránh lặp:
                            is_important = False
                            
                            # 1. Luôn hiện Tool Start/End
                            if kind in ["on_tool_start", "on_tool_end"]:
                                is_important = True
                            # 2. Hiện Chain Start cho node đầu tiên (Hoặc toàn bộ Graph start)
                            elif kind == "on_chain_start" and (node_name == "__start__" or name == "LangGraph"):
                                is_important = True
                            # 3. Hiện Chat Model End cho Suy nghĩ (để lấy content/thinking)
                            elif kind == "on_chat_model_end" and node_name == "agent":
                                is_important = True
                            # 4. Hiện Chain End cho kết quả cuối cùng (LangGraph end)
                            elif kind == "on_chain_end" and name == "LangGraph":
                                is_important = True
                            # 5. Chỉ hiện Chain End cho các node kỹ năng/công cụ khác
                            elif kind == "on_chain_end" and node_name not in ["agent", "__start__", None]:
                                is_important = True
                            
                            is_ignored = any(ignored in (node_name or name) for ignored in technical_nodes)
                            
                            if is_important and not is_ignored:
                                audit_data = {}
                                content = ""
                                
                                if kind.endswith("_start"):
                                    raw_input = event.get("data", {}).get("input")
                                    content = self._format_audit_content(raw_input, kind)
                                    if content: audit_data["input"] = content
                                else:
                                    raw_output = event.get("data", {}).get("output")
                                    content = self._format_audit_content(raw_output, kind)
                                    if content: audit_data["output"] = content
                                    if kind == "on_tool_end":
                                        for artifact in self._extract_artifacts(raw_output):
                                            artifacts.append(artifact)
                                            yield f"data: {json.dumps({'artifact': artifact}, ensure_ascii=False)}\n\n"

                                if content:
                                    safe_audit = self._json_serializable({
                                        "event": kind,
                                        "node": node_key,
                                        "data": audit_data,
                                        "timestamp": datetime.now().isoformat()
                                    })
                                    audit_log.append(safe_audit)
                                    yield f"data: {json.dumps({'audit': safe_audit})}\n\n"

                        if kind == "on_tool_start":
                            status_msg = f"Đang sử dụng công cụ: {event['name']}"
                            if event['name'] == "web_search":
                                status_msg = "🔍 Đang tìm kiếm thông tin trên internet..."
                            elif event['name'] == "web_reader":
                                status_msg = "🌐 Đang đọc nội dung trang web..."
                            elif event['name'] == "pdf_reader":
                                status_msg = "📄 Đang phân tích tài liệu PDF..."
                                
                            yield f"data: {json.dumps({'status': status_msg})}\n\n"
                        
                        elif kind == "on_chat_model_end":
                            # Reset run_id tracking khi model kết thúc
                            if node_name in active_stream_run:
                                del active_stream_run[node_name]
                            
                            # Trích xuất metrics (token usage) nếu có
                            output_data = event.get("data", {}).get("output", {})
                            metadata = None
                            
                            # Kiểm tra metadata trong output (hỗ trợ cả dict và object)
                            if hasattr(output_data, "usage_metadata"):
                                metadata = output_data.usage_metadata
                            elif isinstance(output_data, dict):
                                metadata = output_data.get("usage_metadata")

                            if metadata:
                                # Chuyển đổi sang dict nếu là object để dùng .get()
                                if not isinstance(metadata, dict) and hasattr(metadata, "dict"):
                                    metadata = metadata.dict()
                                elif not isinstance(metadata, dict):
                                    metadata = dict(metadata) if hasattr(metadata, "__iter__") else {}

                                metrics_data = {
                                    "input_tokens": metadata.get("input_tokens", 0),
                                    "output_tokens": metadata.get("output_tokens", 0),
                                    "total_tokens": metadata.get("total_tokens", 0),
                                    "model": event.get("metadata", {}).get("ls_model_name", "Unknown"),
                                    "provider": event.get("metadata", {}).get("ls_provider", "Unknown")
                                }
                                last_metrics = metrics_data
                                yield f"data: {json.dumps({'metrics': metrics_data})}\n\n"
                    
                    # --- KIỂM TRA INTERRUPT (NGOÀI VÒNG LẶP) ---
                    graph_state = await graph.aget_state(thread_config)
                    if graph_state.next:
                        if graph_state.tasks and graph_state.tasks[0].interrupts:
                            interrupt_payload = graph_state.tasks[0].interrupts[0].value
                            logger.info(f"🛑 [HITL] Gửi yêu cầu phê duyệt tới UI: {interrupt_payload}")
                            yield f"data: {json.dumps({'interrupt': interrupt_payload})}\n\n"
                    
                    violations = self._evaluate_guardrails(full_content, guardrails)
                    if violations:
                        action = guardrails.action if guardrails else "warn"
                        guardrails_message = None
                        if guardrails and guardrails.action == "block":
                            guardrails_message = self._build_guardrails_block_message(violations)
                            full_content = guardrails_message

                        yield f"data: {json.dumps({'guardrails': {'scope': 'output', 'action': action, 'violations': violations, 'message': guardrails_message}})}\n\n"

                    # Lưu vào Semantic Cache
                    if full_content and message and message.strip():
                        redis_cache.set_chat_cache(agent_id, user_id, message, {
                            "content": full_content,
                            "thinking": full_thinking,
                            "role": "assistant"
                        }, agent_db=agent_db, thread_id=thread_id)
                    
                    # Cập nhật thông tin cuộc hội thoại
                    stmt = select(Conversation).where(Conversation.thread_id == thread_id)
                    conv_res = await self.agent_repo.db.execute(stmt)
                    conv = conv_res.scalars().first()
                    
                    if conv:
                        logger.info(f"🔍 [DEBUG-TITLE] Đã tìm thấy conversation. Content length: {len(full_content)}")
                        conv.message = full_content
                        conv.thinking = full_thinking
                        conv.role = "assistant"
                        conv.metrics = last_metrics
                        conv.audit = audit_log
                        conv.artifacts = artifacts
                        
                        await self.agent_repo.db.commit()
                        
                        # Không tự động tạo tiêu đề bằng AI; chỉ cập nhật thủ công khi người dùng chỉnh sửa.
                    else:
                        logger.error(f"❌ [DEBUG-TITLE] Không tìm thấy conversation record cho Thread {thread_id}")

                    yield "data: [DONE]\n\n"
                except Exception as e:
                    logger.error(f"Streaming error: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    def _extract_artifacts(self, raw_output):
        candidates = []
        if raw_output is None:
            return candidates
        raw_values = []
        if isinstance(raw_output, str):
            raw_values.append(raw_output)
        elif isinstance(raw_output, dict):
            raw_values.extend([raw_output.get("content"), raw_output.get("output")])
        elif hasattr(raw_output, "content"):
            raw_values.append(getattr(raw_output, "content"))

        for raw_value in raw_values:
            if not raw_value:
                continue
            try:
                payload = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
            except Exception:
                continue
            if isinstance(payload, dict):
                if payload.get("artifact"):
                    candidates.append(payload["artifact"])
                for artifact in payload.get("artifacts") or []:
                    if isinstance(artifact, dict):
                        candidates.append(artifact)
        return candidates

    async def _get_agent_config(self, agent_db, current_user_id=None):
        # Implement "Deep Agents" Skill System pattern
        skills_system_prompt = ""
        if agent_db.skills:
            active_skills = [s for s in agent_db.skills if s.get("is_active", True)]
            if active_skills:
                skills_system_prompt = "\n### 🚀 SKILLS SYSTEM (PRIORITY)\n"
                skills_system_prompt += "You have a library of high-level expert skills. **ALWAYS** prioritize using these skills to handle user requests. "
                skills_system_prompt += "These skills contain specific workflows and guidance on which tools to use for maximum efficiency.\n\n"
                skills_system_prompt += "Follow the **Match-Read-Execute** workflow (MANDATORY):\n"
                skills_system_prompt += "1. **Match**: Compare the user request with the descriptions in the SKILLS LIBRARY below.\n"
                skills_system_prompt += "2. **Read**: If a skill matches, use the `load_skill` tool immediately to get the full execution logic. **IMPORTANT**: Always provide a brief reasoning/thinking part before calling this tool to explain why you chose this skill.\n"
                skills_system_prompt += "3. **Execute**: Strictly follow the instructions and tool-calling strategies provided in the skill's content. Always think before calling each tool.\n\n"
                skills_system_prompt += "SKILLS LIBRARY:\n"
                
                # Fetch descriptions for accurate matching
                skill_names = [s["name"] for s in active_skills]
                result = await self.agent_repo.db.execute(
                    select(Skill.name, Skill.description, Skill.required_tools).where(Skill.name.in_(skill_names))
                )
                skills_data = result.all()
                
                required_tools_from_skills: list[str] = []
                for name, desc, required_tools in skills_data:
                    skills_system_prompt += f"- **{name}**: {desc or 'No description available.'}\n"
                    if isinstance(required_tools, list):
                        required_tools_from_skills.extend([t for t in required_tools if isinstance(t, str) and t.strip()])
                    elif isinstance(required_tools, str):
                        try:
                            import json as _json
                            parsed = _json.loads(required_tools)
                            if isinstance(parsed, list):
                                required_tools_from_skills.extend([t for t in parsed if isinstance(t, str) and t.strip()])
                        except Exception:
                            pass

        # Fetch current user Google tool connection if Gmail tools are enabled.
        # We use current_user_id (the one chatting) instead of agent_db.user_id (the creator)
        user_google_tokens = None
        user_id_to_fetch = current_user_id or agent_db.user_id
        
        has_gmail_tools = any(
            (
                isinstance(t, dict)
                and str(t.get("name", "")).startswith("gmail_")
                and t.get("is_active", True)
            )
            or (isinstance(t, str) and t.startswith("gmail_"))
            or (isinstance(t, dict) and t.get("name") == "Gmail" and t.get("is_active", True))
            or (isinstance(t, str) and t == "Gmail")
            for t in (agent_db.tools or [])
        )

        if has_gmail_tools:
            result = await self.agent_repo.db.execute(
                select(GoogleToolConnection).where(GoogleToolConnection.user_id == user_id_to_fetch)
            )
            connection = result.scalars().first()
            if connection and (connection.status or "active") == "active":
                user_google_tokens = {
                    "access_token": connection.access_token,
                    "refresh_token": connection.refresh_token,
                    "expiry": connection.token_expiry,
                }

        user_facebook_connection = None
        facebook_connection_prompt = ""
        if any(
            (isinstance(t, dict) and str(t.get("name", "")).startswith("facebook_")) or
            (isinstance(t, str) and t.startswith("facebook_"))
            for t in (agent_db.tools or [])
        ):
            fb_result = await self.agent_repo.db.execute(
                select(FacebookConnection).where(FacebookConnection.user_id == user_id_to_fetch)
            )
            fb_connection = fb_result.scalars().first()
            if fb_connection and fb_connection.selected_page_access_token and (fb_connection.status or "active") == "active":
                user_facebook_connection = {
                    "selected_page_id": fb_connection.selected_page_id,
                    "selected_page_name": fb_connection.selected_page_name,
                    "selected_page_access_token": fb_connection.selected_page_access_token,
                    "pages": fb_connection.pages or [],
                    "graph_version": fb_connection.graph_version,
                    "status": fb_connection.status,
                    "expires_at": fb_connection.user_token_expires_at,
                }

                page_lines = []
                for page in (fb_connection.pages or []):
                    marker = " (default)" if page.get("id") == fb_connection.selected_page_id else ""
                    page_lines.append(f"- {page.get('name')} | ID: {page.get('id')}{marker}")

                pages_text = "\n".join(page_lines) if page_lines else "- Không có Fanpage nào khả dụng."
                facebook_connection_prompt = (
                    "\n### FACEBOOK FANPAGE CONNECTION\n"
                    "A Facebook Fanpage connection is already available for this user.\n"
                    f"Default page: {fb_connection.selected_page_name or 'Unknown'} | ID: {fb_connection.selected_page_id or 'N/A'}\n"
                    "Available connected pages:\n"
                    f"{pages_text}\n"
                    "Important rules:\n"
                    "1. Facebook Fanpage tools automatically use the default connected page if page_id is omitted.\n"
                    "2. Do NOT ask the user for page_id or access_token unless they explicitly want to override the default page.\n"
                    "3. When the user asks to message a named customer, use facebook_find_contact or facebook_send_message(contact_query=...) instead of asking for PSID.\n"
                    "4. For analytics/dashboard requests, prefer facebook_generate_dashboard so the UI can render charts.\n"
                    "5. If the user asks which connected Fanpages are available, answer directly from the list above.\n"
                    "6. If no page is connected, only then ask the user to reconnect or choose a page.\n"
                )

        # Combine agent instructions with skills system prompt
        combined_instructions = agent_db.instructions or ""
        if skills_system_prompt:
            combined_instructions += skills_system_prompt
        if facebook_connection_prompt:
            combined_instructions += facebook_connection_prompt

        system_guardrails = await self._get_system_guardrails()
        combined_instructions += self._build_guardrails_instructions(system_guardrails)

        from app.core.security import decrypt_password
        tools_list = agent_db.tools or []
        if required_tools_from_skills:
            existing = set()
            for t in tools_list:
                if isinstance(t, str):
                    existing.add(t)
                elif isinstance(t, dict) and t.get("name"):
                    existing.add(str(t.get("name")))
            for tool_name in required_tools_from_skills:
                if tool_name not in existing:
                    tools_list.append(tool_name)
                    existing.add(tool_name)

        return {
            "id": agent_db.id,
            "user_id": agent_db.user_id,
            "name": agent_db.name,
            "specialty": agent_db.specialty,
            "description": agent_db.description,
            "model_provider": agent_db.model_provider,
            "model_name": agent_db.model_name,
            "api_key": decrypt_password(agent_db.api_key) if agent_db.api_key else None,
            "instructions": combined_instructions,
            "tools": tools_list,
            "knowledge_files": agent_db.knowledge_files or [],
            "skills": agent_db.skills or [],
            "embedding_provider": agent_db.embedding_provider,
            "embedding_model": agent_db.embedding_model,
            "embedding_api_key": decrypt_password(agent_db.embedding_api_key) if agent_db.embedding_api_key else None,
            "user_google_tokens": user_google_tokens,
            "user_facebook_connection": user_facebook_connection,
        }

    def _prepare_input_state(self, agent_id, instructions, message, cache_reference=""):
        messages = [("user", message)]
        
        # Nếu có cache, đưa vào làm Nhật ký kinh nghiệm (Experience Diary)
        if cache_reference:
            messages.insert(0, ("system", f"📜 NHẬT KÝ KINH NGHIỆM (Dữ liệu từ phiên chat trước cho câu hỏi tương tự):\n{cache_reference}\n\nLƯU Ý: Đây là cách bạn đã suy luận và trả lời trong quá khứ. Hãy sử dụng nó để: (1) Hiểu bối cảnh cũ, (2) Tránh lặp lại sai lầm nếu kết quả cũ bị lỗi hoặc thiếu chính xác, (3) Tối ưu hóa quy trình tra cứu bằng công cụ hiện tại."))

        return {
            "messages": messages,
            "agent_id": agent_id,
            "instructions": instructions or "",
            "metadata": {
                "has_cache": bool(cache_reference)
            }
        }

    async def get_conversations(self, user_id: str, agent_id: str = None):
        """Lấy danh sách các phiên hội thoại"""
        from sqlalchemy import select, desc
        from app.models.conversation import Conversation
        
        stmt = select(Conversation).where(Conversation.user_id == user_id)
        if agent_id:
            stmt = stmt.where(Conversation.agent_id == agent_id)
        
        stmt = stmt.order_by(desc(Conversation.updated_at))
        result = await self.agent_repo.db.execute(stmt)
        return result.scalars().all()

    async def get_thread_history(self, thread_id: str, user_id: str):
        """Lấy lịch sử tin nhắn sạch cho UI (ẩn ToolMessages, gộp Thinking)"""
        pool = await self.get_pool()
        checkpointer = AsyncPostgresSaver(pool)
        config = {"configurable": {"thread_id": thread_id}}
        state = await checkpointer.aget(config)
        if not state:
            return []
        
        messages = state.get("channel_values", {}).get("messages", [])
        formatted = []
        
        for msg in messages:
            m_type = getattr(msg, "type", "")
            
            # 1. Nếu là tin nhắn của người dùng
            if m_type == "human":
                formatted.append({
                    "role": "user",
                    "content": msg.content if isinstance(msg.content, str) else str(msg.content),
                    "done": True
                })
                continue
                
            # 2. Bỏ qua các tin nhắn Tool hoặc System để UI sạch sẽ (đã có Audit Log lo phần này)
            if m_type in ["tool", "system"]:
                continue
                
            # 3. Xử lý tin nhắn AI (Assistant)
            if m_type == "ai":
                content = ""
                thinking = ""
                
                # Trích xuất content và thinking từ các định dạng khác nhau
                if isinstance(msg.content, list):
                    text_parts = []
                    for part in msg.content:
                        if isinstance(part, dict):
                            p_type = part.get("type", "")
                            if p_type in ["thinking", "thought", "reasoning"]:
                                thinking += str(part.get("thinking") or part.get("thought") or part.get("reasoning") or "")
                            elif p_type == "text":
                                text_parts.append(part.get("text", ""))
                        elif isinstance(part, str):
                            text_parts.append(part)
                    content = "".join(text_parts)
                else:
                    content = str(msg.content)
                
                # Xử lý thẻ <thinking> XML nếu có trong content
                import re
                thinking_match = re.search(r'<(thinking|thought|reasoning)>(.*?)</\1>', content, re.DOTALL)
                if thinking_match:
                    thinking += thinking_match.group(2).strip()
                    content = re.sub(r'<(thinking|thought|reasoning)>.*?</\1>', '', content, flags=re.DOTALL).strip()
                
                # Nếu message cuối cùng cũng là assistant, ta gộp vào (tránh bị chia nhỏ bubble)
                if formatted and formatted[-1]["role"] == "assistant":
                    last = formatted[-1]
                    if thinking:
                        last["thinking"] = (last.get("thinking") or "") + "\n" + thinking if last.get("thinking") else thinking
                    if content:
                        last["content"] = (last.get("content") or "") + "\n" + content if last.get("content") else content
                else:
                    # Tạo bubble assistant mới
                    # Chỉ thêm nếu có nội dung hoặc có thinking (tránh bubble trống khi chỉ gọi tool)
                    if content or thinking:
                        formatted.append({
                            "role": "assistant",
                            "content": content,
                            "thinking": thinking,
                            "done": True
                        })
        
        # 4. Làm giàu tin nhắn cuối với Audit Log & Metrics từ DB
        if formatted and formatted[-1]["role"] == "assistant":
            stmt = select(Conversation).where(Conversation.thread_id == thread_id)
            conv_res = await self.agent_repo.db.execute(stmt)
            conv = conv_res.scalars().first()
            if conv:
                formatted[-1]["audit"] = conv.audit
                formatted[-1]["metrics"] = conv.metrics
                formatted[-1]["artifacts"] = conv.artifacts
        
        return formatted

    async def get_thread_audit(self, thread_id: str, user_id: str):
        """Lấy luồng thực thi (audit log) đã được tinh lọc và làm sạch"""
        stmt = select(Conversation).where(Conversation.thread_id == thread_id)
        res = await self.agent_repo.db.execute(stmt)
        conv = res.scalars().first()
        if not conv: return []
            
        # ƯU TIÊN 1: Sử dụng Audit Log đã lưu sẵn trong DB (Chính xác nhất cho các cuộc hội thoại mới)
        if conv.audit and isinstance(conv.audit, list):
            return conv.audit

        # ƯU TIÊN 2: Tái cấu trúc từ Graph History (Fallback cho hội thoại cũ)
        agent_db = await self.agent_repo.get_by_id(conv.agent_id, conv.user_id)
        if not agent_db: return []
        agent_config = await self._get_agent_config(agent_db, current_user_id=user_id)
        
        pool = await self.get_pool()
        checkpointer = AsyncPostgresSaver(pool)
        store = await self.get_store(pool)
        
        has_workflow = False
        if agent_db.workflow_id:
            from app.models.workflow import Workflow
            result = await self.agent_repo.db.execute(select(Workflow).where(Workflow.id == agent_db.workflow_id))
            workflow_db = result.scalar_one_or_none()
            if workflow_db:
                from app.agents.workflow_executor import WorkflowExecutor
                executor = WorkflowExecutor(workflow_db.graph, agent_config)
                graph = executor.app
                has_workflow = True
                
        if not has_workflow:
            graph = create_chat_graph(agent_config, checkpointer=checkpointer, store=store)
        
        config = {"configurable": {"thread_id": thread_id}}
        raw_history = [state async for state in graph.aget_state_history(config)]
        raw_history.reverse() 
        
        final_logs = []
        technical_nodes = ["_after_tool_check", "__start__", "__end__", "chain stream", "memorize"]
        node_map = {
            "agent": "Suy nghĩ", 
            "load_skill": "Nạp Kỹ năng", 
            "tools": "Sử dụng Công cụ", 
            "__start__": "Đầu vào",
            "LangGraph": "Quy trình Tổng thể"
        }

        for state in raw_history:
            metadata = state.metadata or {}
            node_name = metadata.get("source", "unknown")
            writes = {}
            if hasattr(state, "tasks") and state.tasks:
                task = state.tasks[0]
                node_name = task.name
                writes = getattr(task, "result", {}) or {}
            elif node_name in ["input", "__start__"]:
                node_name = "__start__"
                if hasattr(state, "values") and isinstance(state.values, dict) and "messages" in state.values:
                    human_msgs = [m for m in state.values["messages"] if getattr(m, "type", "") == "human"]
                    if human_msgs: writes = {"messages": [human_msgs[-1]]}

            if node_name in technical_nodes or not writes:
                continue

            # Chỉ lấy tin nhắn cuối cùng để làm nội dung
            msgs = writes.get("messages", []) if isinstance(writes, dict) else []
            if not msgs: continue
            msg = msgs[-1]

            node_label = node_map.get(node_name, node_name)
            content = self._format_audit_content(msg)
            
            # Lọc trùng lặp logic tương tự stream_chat
            # - Đầu vào: luôn hiện
            # - Agent: thường hiện ở Model End, ở đây ta lấy kết quả node
            # - Các node khác: hiện kết quả cuối
            if content:
                final_logs.append({
                    "node": node_label,
                    "data": {"output": content},
                    "timestamp": getattr(state, "created_at", datetime.now()).isoformat() if not isinstance(getattr(state, "created_at", ""), str) else getattr(state, "created_at", ""),
                    "event": "on_chain_end"
                })
            
        return final_logs

        # Deduplication cơ bản (Chỉ cần lọc những state liền kề)
        deduped_logs = []
        for log in final_logs:
            if deduped_logs:
                prev = deduped_logs[-1]
                if prev["node"] == log["node"] and prev["content"] == log["content"] and not log["has_tools"]:
                    continue
                if log["node"] == "Đầu vào" and prev["node"] == "Đầu vào":
                    continue
            deduped_logs.append(log)
            
        return deduped_logs

    async def delete_conversation(self, thread_id: str, user_id: str):
        """Xóa sạch hội thoại khỏi DB, Checkpoints (LangGraph), Cache (Redis & Qdrant)"""
        # 1. Kiểm tra quyền sở hữu và lấy agent_id
        stmt = select(Conversation).where(Conversation.thread_id == thread_id, Conversation.user_id == user_id)
        res = await self.agent_repo.db.execute(stmt)
        conv = res.scalars().first()
        
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found or access denied")
        
        agent_id = conv.agent_id
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        
        # 2. Xóa khỏi LangGraph Checkpoints (PostgreSQL)
        pool = await self.get_pool()
        async with pool.connection() as conn:
            async with conn.cursor() as cur:
                # Xóa từ các bảng của LangGraph theo thứ tự ngược lại để tránh lỗi khóa ngoại (nếu có)
                try:
                    await cur.execute("DELETE FROM checkpoint_writes WHERE thread_id = %s", (thread_id,))
                    await cur.execute("DELETE FROM checkpoint_blobs WHERE thread_id = %s", (thread_id,))
                    await cur.execute("DELETE FROM checkpoints WHERE thread_id = %s", (thread_id,))
                except Exception as e:
                    logger.warning(f"⚠️ Lỗi khi xóa checkpoints (có thể bảng không tồn tại): {e}")
                await conn.commit()
        
        # 3. Xóa Semantic Cache (Redis & Qdrant)
        if agent_db:
            redis_cache.clear_chat_cache(agent_db, thread_id, user_id)
        
        # 4. Xóa bản ghi Conversation (PostgreSQL)
        await self.agent_repo.db.delete(conv)
        await self.agent_repo.db.commit()
        
        logger.info(f"🗑️ Đã xóa sạch toàn bộ dữ liệu cho Thread: {thread_id}")
        return {"status": "success", "message": f"Conversation {thread_id} deleted successfully"}

    async def update_conversation_title(self, thread_id: str, user_id: str, new_title: str):
        """Cập nhật tiêu đề hội thoại thủ công"""
        stmt = select(Conversation).where(Conversation.thread_id == thread_id, Conversation.user_id == user_id)
        res = await self.agent_repo.db.execute(stmt)
        conv = res.scalars().first()
        
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
            
        conv.title = new_title[:100]
        await self.agent_repo.db.commit()
        return {"status": "success", "title": conv.title}
