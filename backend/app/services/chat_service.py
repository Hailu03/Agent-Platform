import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.repositories.agent_repo import AgentRepository
from app.agents.graph import create_chat_graph
from typing import AsyncGenerator
from app.core.logging import get_logger

logger = get_logger(__name__)

class ChatService:
    _pool = None

    def __init__(self, agent_repo: AgentRepository):
        self.agent_repo = agent_repo

    @classmethod
    async def get_pool(cls):
        if cls._pool is None:
            from psycopg_pool import AsyncConnectionPool
            from app.core.config import settings
            
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
                    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
                    from langgraph.store.postgres.aio import AsyncPostgresStore
                    await AsyncPostgresSaver(conn).setup()
                    await AsyncPostgresStore(conn).setup()
                logger.info("✅ Khởi tạo xong.")
        return cls._pool

    async def process_chat(self, agent_id: str, user_id: str, message: str):
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
            raise HTTPException(status_code=404, detail="Agent not found")

        # 1. Kiểm tra Cache trước (Kèm user_id và agent_db)
        from app.core.redis import redis_cache
        cached_res = redis_cache.get_chat_cache(agent_id, user_id, message, agent_db=agent_db)
        if cached_res:
            return cached_res

        agent_config = self._get_agent_config(agent_db)
        graph = create_chat_graph(agent_config)
        
        input_state = self._prepare_input_state(agent_id, agent_db, message)
        
        final_state = await graph.ainvoke(input_state)
        ai_message = final_state["messages"][-1]
        
        result = {"role": "assistant", "content": ai_message.content}
        
        # 2. Lưu vào Cache (Kèm user_id và agent_db)
        redis_cache.set_chat_cache(agent_id, user_id, message, result, agent_db=agent_db)
        
        return result

    async def stream_chat(self, agent_id: str, user_id: str, message: str) -> StreamingResponse:
        """
        API chính để chat với luồng dữ liệu đổ về liên tục (SSE) + Redis Cache + Redis Checkpointer
        """
        from app.core.redis import redis_cache
        from langgraph.checkpoint.redis import AsyncRedisSaver
        from app.core.config import settings
        
        # --- LẤY THÔNG TIN AGENT TRƯỚC ĐỂ CÓ API KEY ---
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
             # Đây là generator nên phải yield lỗi
             async def error_gen():
                 yield f"data: {json.dumps({'error': 'Agent not found'})}\n\n"
             return StreamingResponse(error_gen(), media_type="text/event-stream")

        # 1. Kiểm tra Semantic Cache (Lấy làm nhật ký tham khảo)
        cached_res = redis_cache.get_chat_cache(agent_id, user_id, message, agent_db=agent_db)
        cache_ref_text = ""
        if cached_res:
            logger.info(f"💡 Tìm thấy nhật ký tư duy cũ từ Semantic Cache cho User {user_id}")
            old_thinking = cached_res.get("thinking", "Không có dữ liệu tư duy.")
            old_content = cached_res.get("content", "")
            cache_ref_text = f"--- NHẬT KÝ TƯ DUY CŨ ---\n{old_thinking}\n\n--- KẾT QUẢ CŨ ---\n{old_content}"

        async def event_generator():
            # --- ĐÃ CÓ AGENT DB Ở TRÊN ---
            agent_config = self._get_agent_config(agent_db)
            
            # Khởi tạo Postgres Checkpointer (Lưu vào DB lâu dài)
            from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
            from langgraph.store.postgres.aio import AsyncPostgresStore
            
            pool = await self.get_pool()
            checkpointer = AsyncPostgresSaver(pool)
            
            # Hàm custom embed dùng cấu hình của Agent
            async def custom_embed(texts: list[str]) -> list[list[float]]:
                from app.agents.factory import get_embeddings
                emb = get_embeddings(
                    provider=agent_db.embedding_provider,
                    model=agent_db.embedding_model,
                    api_key=agent_db.embedding_api_key
                )
                return await emb.aembed_documents(texts)
                
            # Lấy số chiều thực tế của model bằng cách embed thử một chuỗi
            sample_emb = await custom_embed(["test"])
            actual_dims = len(sample_emb[0])
            logger.info(f"🔍 Detected embedding dimensions: {actual_dims} for model {agent_db.embedding_model}")

            store = AsyncPostgresStore(
                pool,
                index={
                    "embed": custom_embed,
                    "dims": actual_dims
                }
            )
            
            # Đã setup ở get_pool() rồi, không cần gọi lại ở đây
            logger.info("⚙️ Đang khởi tạo Graph...")
            graph = create_chat_graph(agent_config, checkpointer=checkpointer, store=store)
            thread_config = {"configurable": {"thread_id": user_id}}
            input_state = self._prepare_input_state(agent_id, agent_db, message, cache_reference=cache_ref_text)
            
            logger.info(f"🟢 Bắt đầu Stream cho User {user_id}...")
            full_content = ""
            full_thinking = ""

            try:
                from app.agents.states.agent_state import Context
                context_obj = Context(user_id=user_id, agent_id=agent_id)
                
                async for event in graph.astream_events(
                    input_state, 
                    config=thread_config, 
                    version="v2",
                    context=context_obj
                ):
                    kind = event.get("event")
                    node_name = event.get("metadata", {}).get("langgraph_node", "")
                    
                    if kind == "on_chat_model_stream":
                        chunk = event["data"]["chunk"]
                        content = chunk.content
                        thinking = ""
                        
                        if hasattr(chunk, "additional_kwargs") and "thinking" in chunk.additional_kwargs:
                            thinking = chunk.additional_kwargs.get("thinking", "")
                        
                        if node_name == "summarizer":
                            if isinstance(content, list):
                                for part in content:
                                    thinking += part.get("text", "") if isinstance(part, dict) else str(part)
                            else:
                                thinking += str(content)
                            content = ""

                        if isinstance(content, list):
                            text_parts = []
                            for part in content:
                                if isinstance(part, dict):
                                    if part.get("type") == "thinking":
                                        thinking += part.get("thinking", "")
                                    else:
                                        text_parts.append(part.get("text", ""))
                                else:
                                    text_parts.append(str(part))
                            content = "".join(text_parts)

                        if thinking:
                            full_thinking += str(thinking)
                            yield f"data: {json.dumps({'thinking': str(thinking)})}\n\n"
                        
                        # --- LOGIC TÁCH THẺ <thinking> THÔNG MINH ---
                        if content:
                            content_str = str(content)
                            
                            # Nếu đang trong chế độ thinking (đã gặp <thinking> nhưng chưa gặp </thinking>)
                            if getattr(self, "_in_thinking", False):
                                if "</thinking>" in content_str:
                                    parts = content_str.split("</thinking>")
                                    full_thinking += parts[0]
                                    yield f"data: {json.dumps({'thinking': parts[0]})}\n\n"
                                    self._in_thinking = False
                                    if len(parts) > 1 and parts[1]:
                                        full_content += parts[1]
                                        yield f"data: {json.dumps({'content': parts[1]})}\n\n"
                                else:
                                    full_thinking += content_str
                                    yield f"data: {json.dumps({'thinking': content_str})}\n\n"
                            else:
                                if "<thinking>" in content_str:
                                    parts = content_str.split("<thinking>")
                                    if parts[0]:
                                        full_content += parts[0]
                                        yield f"data: {json.dumps({'content': parts[0]})}\n\n"
                                    
                                    self._in_thinking = True
                                    thinking_part = parts[1]
                                    if "</thinking>" in thinking_part:
                                        t_parts = thinking_part.split("</thinking>")
                                        full_thinking += t_parts[0]
                                        yield f"data: {json.dumps({'thinking': t_parts[0]})}\n\n"
                                        self._in_thinking = False
                                        if len(t_parts) > 1 and t_parts[1]:
                                            full_content += t_parts[1]
                                            yield f"data: {json.dumps({'content': t_parts[1]})}\n\n"
                                    else:
                                        full_thinking += thinking_part
                                        yield f"data: {json.dumps({'thinking': thinking_part})}\n\n"
                                else:
                                    full_content += content_str
                                    yield f"data: {json.dumps({'content': content_str})}\n\n"
                    
                    elif kind == "on_tool_start":
                        status_msg = f"Đang sử dụng công cụ: {event['name']}"
                        if event['name'] == "web_search":
                            status_msg = "🔍 Đang tìm kiếm thông tin trên internet..."
                        elif event['name'] == "web_reader":
                            status_msg = "🌐 Đang đọc nội dung trang web..."
                        elif event['name'] == "pdf_reader":
                            status_msg = "📄 Đang phân tích tài liệu PDF..."
                            
                        yield f"data: {json.dumps({'status': status_msg})}\n\n"
                
                # Lưu vào Semantic Cache sau khi hoàn thành (Sử dụng cấu hình của agent)
                if full_content:
                    redis_cache.set_chat_cache(agent_id, user_id, message, {
                        "content": full_content,
                        "thinking": full_thinking,
                        "role": "assistant"
                    }, agent_db=agent_db)

                yield "data: [DONE]\n\n"
            except Exception as e:
                logger.error(f"Streaming error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    def _get_agent_config(self, agent_db):
        return {
            "name": agent_db.name,
            "specialty": agent_db.specialty,
            "description": agent_db.description,
            "model_provider": agent_db.model_provider,
            "model_name": agent_db.model_name,
            "api_key": agent_db.api_key,
            "instructions": agent_db.instructions,
            "tools": agent_db.tools,
            "knowledge_files": agent_db.knowledge_files or [],
        }

    def _prepare_input_state(self, agent_id, agent_db, message, cache_reference=""):
        messages = [("user", message)]
        
        # Nếu có cache, đưa vào làm Nhật ký kinh nghiệm (Experience Diary)
        if cache_reference:
            messages.insert(0, ("system", f"📜 NHẬT KÝ KINH NGHIỆM (Dữ liệu từ phiên chat trước cho câu hỏi tương tự):\n{cache_reference}\n\nLƯU Ý: Đây là cách bạn đã suy luận và trả lời trong quá khứ. Hãy sử dụng nó để: (1) Hiểu bối cảnh cũ, (2) Tránh lặp lại sai lầm nếu kết quả cũ bị lỗi hoặc thiếu chính xác, (3) Tối ưu hóa quy trình tra cứu bằng công cụ hiện tại."))

        return {
            "messages": messages,
            "agent_id": agent_id,
            "instructions": agent_db.instructions or "",
            "metadata": {
                "has_cache": bool(cache_reference)
            }
        }
