import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.core.redis import redis_cache
from app.models.agent import Agent
from app.models.skill import Skill
from app.models.user import User
from app.core.config import settings
from app.core.logging import get_logger
from app.agents.graph import create_chat_graph
from app.agents.factory import get_embeddings
from app.agents.states.agent_state import Context
from app.repositories.agent_repo import AgentRepository
from sqlalchemy import select, desc
from app.models.skill import Skill
from app.models.conversation import Conversation
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres.aio import AsyncPostgresStore
from psycopg_pool import AsyncConnectionPool

logger = get_logger(__name__, log_file="logs/chat_service.log")

class ChatService:
    _pool = None

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
            
            if not exists:
                logger.info("🛠️ Khởi tạo Database mới hoàn toàn...")
                import psycopg
                psycopg_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
                async with await psycopg.AsyncConnection.connect(psycopg_url, autocommit=True) as conn:
                    await AsyncPostgresSaver(conn).setup()
                    await AsyncPostgresStore(conn).setup()
                logger.info("✅ Khởi tạo xong.")
        return cls._pool

    async def process_chat(self, agent_id: str, user_id: str, message: str, thread_id: str = None, command: dict = None):
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
            raise HTTPException(status_code=404, detail="Agent not found")

        # 1. Kiểm tra Cache trước
        cached_res = redis_cache.get_chat_cache(agent_id, user_id, message, agent_db=agent_db, thread_id=thread_id)
        if cached_res:
            return cached_res

        agent_config = await self._get_agent_config(agent_db, current_user_id=user_id)
        pool = await self.get_pool()
        checkpointer = AsyncPostgresSaver(pool)
        graph = create_chat_graph(agent_config, checkpointer=checkpointer)
        
        # Sử dụng thread_id cụ thể
        final_thread_id = thread_id or f"direct:{user_id}"
        thread_config = {"configurable": {"thread_id": final_thread_id}}
        
        input_state = self._prepare_input_state(agent_id, agent_db, message)
        
        from langgraph.types import Command
        input_data = Command(resume=command) if command else input_state
        
        final_state = await graph.ainvoke(input_data, config=thread_config)
        ai_message = final_state["messages"][-1]
        
        result = {"role": "assistant", "content": ai_message.content}
        
        # 2. Lưu vào Cache
        if message and message.strip():
            redis_cache.set_chat_cache(agent_id, user_id, message, result, agent_db=agent_db, thread_id=thread_id)
        
        return result

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
            from app.core.security import decrypt_password
            from contextlib import AsyncExitStack
            
            # --- ĐÃ CÓ AGENT DB Ở TRÊN ---
            agent_config = await self._get_agent_config(agent_db, current_user_id=user_id)
            
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
                graph = create_chat_graph(agent_config, checkpointer=checkpointer, store=store)
                
                # Metadata isolation
                thread_config = {"configurable": {"thread_id": thread_id}}
                
                # --- LƯU CONVERSATION NẾU LÀ MỚI ---
                if is_new_thread:
                    title = message[:40] + ("..." if len(message) > 40 else "")
                    new_conv = Conversation(
                        user_id=user_id,
                        agent_id=agent_id,
                        thread_id=thread_id,
                        title=title,
                        last_message=message
                    )
                    self.agent_repo.db.add(new_conv)
                    await self.agent_repo.db.commit()
                    # Gửi thread_id về UI ngay lập tức để sync
                    yield f"data: {json.dumps({'thread_id': thread_id, 'title': title})}\n\n"
                
                input_state = self._prepare_input_state(agent_id, agent_config["instructions"], message, cache_reference=cache_ref_text)
            
                logger.info(f"🟢 Bắt đầu Stream cho User {user_id}...")
                full_content = ""
                full_thinking = ""
                in_thinking_mode = False # Trạng thái tư duy cục bộ cho mỗi stream
                last_part_was_structured = False # Theo dõi nếu part trước đó là structured thinking
                current_node = None # Theo dõi node hiện tại để phân tách thinking

                try:
                    context_obj = Context(user_id=user_id, agent_id=agent_id)
                    
                    # Nếu có command, thực hiện resume thay vì truyền input_state mới
                    from langgraph.types import Command
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
                            
                            # Log nhẹ để debug xem AI gửi gì về
                            logger.info(f"📦 Chunk data keys: {list(event['data']['chunk'].__dict__.keys()) if hasattr(event['data']['chunk'], '__dict__') else 'N/A'}")
                            
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
                            
                            # Chỉ lấy content từ node chính (agent)
                            is_output_node = node_name in ["agent"]
                            
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


                        
                        elif kind == "on_tool_start":
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
                    
                    # --- KIỂM TRA INTERRUPT ---
                    graph_state = await graph.aget_state(thread_config)
                    if graph_state.next:
                        if graph_state.tasks and graph_state.tasks[0].interrupts:
                            interrupt_payload = graph_state.tasks[0].interrupts[0].value
                            logger.info(f"🛑 [HITL] Gửi yêu cầu phê duyệt tới UI: {interrupt_payload}")
                            yield f"data: {json.dumps({'interrupt': interrupt_payload})}\n\n"
                    
                    # Lưu vào Semantic Cache
                    if full_content and message and message.strip():
                        redis_cache.set_chat_cache(agent_id, user_id, message, {
                            "content": full_content,
                            "thinking": full_thinking,
                            "role": "assistant"
                        }, agent_db=agent_db, thread_id=thread_id)
                        
                        stmt = select(Conversation).where(Conversation.thread_id == thread_id)
                        conv_res = await self.agent_repo.db.execute(stmt)
                        conv = conv_res.scalars().first()
                        if conv:
                            conv.last_message = full_content[:100]
                            await self.agent_repo.db.commit()

                    yield "data: [DONE]\n\n"
                except Exception as e:
                    logger.error(f"Streaming error: {e}")
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

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
                    select(Skill.name, Skill.description).where(Skill.name.in_(skill_names))
                )
                skills_data = result.all()
                
                for name, desc in skills_data:
                    skills_system_prompt += f"- **{name}**: {desc or 'No description available.'}\n"

        # Fetch current user google tokens if email manager is enabled
        # We use current_user_id (the one chatting) instead of agent_db.user_id (the creator)
        user_google_tokens = None
        user_id_to_fetch = current_user_id or agent_db.user_id
        
        if any(t.get("name") == "Quản lý Email" and t.get("is_active", True) for t in (agent_db.tools or [])):
            result = await self.agent_repo.db.execute(select(User).where(User.id == user_id_to_fetch))
            user = result.scalars().first()
            if user:
                user_google_tokens = {
                    "access_token": user.google_access_token,
                    "refresh_token": user.google_refresh_token,
                    "expiry": user.google_token_expiry
                }

        # Combine agent instructions with skills system prompt
        combined_instructions = agent_db.instructions or ""
        if skills_system_prompt:
            combined_instructions += skills_system_prompt

        from app.core.security import decrypt_password
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
            "tools": agent_db.tools or [],
            "knowledge_files": agent_db.knowledge_files or [],
            "skills": agent_db.skills or [],
            "embedding_provider": agent_db.embedding_provider,
            "embedding_model": agent_db.embedding_model,
            "embedding_api_key": decrypt_password(agent_db.embedding_api_key) if agent_db.embedding_api_key else None,
            "user_google_tokens": user_google_tokens
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
        stmt = select(Conversation).where(Conversation.user_id == user_id)
        if agent_id:
            stmt = stmt.where(Conversation.agent_id == agent_id)
        
        stmt = stmt.order_by(desc(Conversation.updated_at))
        result = await self.agent_repo.db.execute(stmt)
        return result.scalars().all()

    async def get_thread_history(self, thread_id: str, user_id: str):
        """Lấy lịch sử tin nhắn của một thread từ LangGraph Checkpointer"""
        pool = await self.get_pool()
        checkpointer = AsyncPostgresSaver(pool)
        config = {"configurable": {"thread_id": thread_id}}
        state = await checkpointer.aget(config)
        if not state:
            return []
        
        # Extract messages from state
        messages = state.get("channel_values", {}).get("messages", [])
        formatted = []
        for msg in messages:
            role = "user" if hasattr(msg, "type") and msg.type == "human" else "assistant"
            
            # Đảm bảo content luôn là string (LangGraph có thể trả về list các content parts)
            content = msg.content if hasattr(msg, "content") else str(msg)
            # Extract thinking if present
            thinking = ""
            if hasattr(msg, "additional_kwargs"):
                thinking = msg.additional_kwargs.get("thinking", "") or msg.additional_kwargs.get("thought", "")
            
            # Nếu content là list, trích xuất thinking từ các part
            if isinstance(msg.content, list):
                text_parts = []
                for part in msg.content:
                    if isinstance(part, dict):
                        p_type = part.get("type", "")
                        if p_type in ["thinking", "thought", "reasoning"]:
                            p_thinking = part.get("thinking") or part.get("thought") or part.get("reasoning") or part.get("text")
                            if p_thinking:
                                thinking += str(p_thinking)
                        elif p_type == "text":
                            text_parts.append(part.get("text", ""))
                    elif isinstance(part, str):
                        text_parts.append(part)
                content = "".join(text_parts)
            else:
                content = msg.content if hasattr(msg, "content") else str(msg)
            
            formatted.append({
                "role": role,
                "content": content,
                "thinking": thinking,
                "done": True
            })
        return formatted
