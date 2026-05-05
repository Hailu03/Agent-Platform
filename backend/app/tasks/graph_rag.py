from app.celery_worker import celery_app
from app.services.graph_rag_service import GraphRAGService
from app.agents.providers.google import GoogleProvider
from app.core.logging import get_logger
import asyncio

logger = get_logger(__name__)

@celery_app.task(name="app.tasks.graph_rag.process_document_task")
def process_document_task(
    file_url: str, 
    provider: str, 
    model_name: str, 
    api_key: str = None, 
    metadata: dict = None,
    embedding_provider: str = "google",
    embedding_model: str = "models/embedding-001",
    embedding_api_key: str = None
):
    """
    Celery task để tải tài liệu từ URL, trích xuất text và nạp vào GraphRAG.
    """
    logger.info(f"👷 Worker đang tải tài liệu từ {file_url}...")
    
    async def _run():
        try:
            from app.core.storage import storage_service
            import os
            import io
            
            # 1. Tải file từ Storage
            # Giả định object_name có thể suy ra từ URL hoặc được truyền vào
            # Ở đây tôi sẽ dùng URL để tải
            content_bytes = storage_service.get_file(file_url) # Cần đảm bảo storage_service có hàm này
            
            # 2. Trích xuất văn bản
            text_content = ""
            file_ext = os.path.splitext(metadata.get("filename", "") or file_url)[1].lower()
            
            if file_ext == ".pdf":
                import pdfplumber
                with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
                    text_content = "\n".join([page.extract_text() or "" for page in pdf.pages[:50]]) # Tăng lên 50 trang
            else:
                text_content = content_bytes.decode("utf-8", errors="ignore")

            if not text_content.strip():
                logger.warning(f"⚠️ Không có nội dung văn bản để nạp từ {file_url}")
                return

            # 3. Khởi tạo LLM và xử lý
            from app.agents.factory import get_model
            llm = get_model(provider, model_name, api_key=api_key)
            agent_id = (metadata or {}).get("agent_id")
            agent_name = (metadata or {}).get("agent_name")
            service = GraphRAGService(
                llm=llm, 
                embedding_config={
                    "provider": embedding_provider,
                    "model": embedding_model,
                    "api_key": embedding_api_key
                },
                chat_api_key=api_key,
                chat_provider=provider,
                chat_model_name=model_name,
                agent_id=agent_id,
                agent_name=agent_name,
                collection_type="kb"
            )
            
            await service.process_document(text_content, metadata)
            logger.info(f"✅ Hoàn thành nạp dữ liệu từ {file_url} vào GraphRAG.")
        except Exception as e:
            logger.error(f"❌ Worker gặp lỗi khi xử lý GraphRAG cho {file_url}: {str(e)}")
            raise e

    # Chạy async function trong sync celery task
    try:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        loop.run_until_complete(_run())
    except Exception as e:
        logger.error(f"❌ Lỗi thực thi async task: {str(e)}")

@celery_app.task(name="app.tasks.graph_rag.delete_document_task")
def delete_document_task(file_url: str, embedding_provider: str = "google", embedding_model: str = "models/embedding-001", agent_id: str = None):
    """
    Celery task để xóa tri thức liên quan đến một file khỏi GraphRAG.
    """
    logger.info(f"🧹 Worker đang dọn dẹp tri thức cho file: {file_url} (Agent: {agent_id})")
    
    async def _run():
        try:
            # Khởi tạo service
            from app.models.base import AsyncSessionLocal
            from app.models.agent import Agent
            from sqlalchemy import select
            
            agent_name = "Global"
            if agent_id:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(Agent).where(Agent.id == agent_id))
                    agent_obj = result.scalar_one_or_none()
                    if agent_obj:
                        agent_name = agent_obj.name

            service = GraphRAGService(
                llm=None, 
                embedding_config={
                    "provider": embedding_provider,
                    "model": embedding_model
                },
                agent_id=agent_id,
                agent_name=agent_name
            )
            
            # Sử dụng hàm xóa tập trung trong service
            await service.delete_document(file_url)
            
            logger.info(f"✅ Đã dọn dẹp xong toàn bộ tri thức của {file_url}")
        except Exception as e:
            logger.error(f"❌ Worker gặp lỗi khi dọn dẹp GraphRAG: {str(e)}")

    # Chạy async function trong sync celery task
    try:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.run_until_complete(_run())
    except Exception as e:
        logger.error(f"❌ Lỗi thực thi async task xóa: {str(e)}")

@celery_app.task(name="app.tasks.graph_rag.delete_datasource_task")
def delete_datasource_task(datasource_id: str, agent_id: str = None):
    """
    Celery task để xóa sạch dữ liệu GraphRAG liên quan đến một Connector.
    """
    logger.info(f"🧹 Worker đang dọn dẹp dữ liệu cho Connector: {datasource_id}")
    
    async def _run():
        try:
            # Khởi tạo service (nếu có agent_id thì dùng để định danh collection qdrant)
            service = GraphRAGService(
                llm=None, 
                embedding_config={"provider": "google", "model": "models/embedding-001"},
                agent_id=agent_id,
                agent_name="Global"
            )
            
            await service.delete_datasource(datasource_id)
            logger.info(f"✅ Đã dọn dẹp xong dữ liệu Connector {datasource_id}")
        except Exception as e:
            logger.error(f"❌ Worker gặp lỗi khi dọn dẹp Connector: {str(e)}")

    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(_run())

@celery_app.task(name="app.tasks.graph_rag.delete_agent_graph_task")
def delete_agent_graph_task(agent_id: str):
    """
    Celery task để xóa sạch TOÀN BỘ dữ liệu GraphRAG của một Agent.
    """
    logger.info(f"🗑️ Worker đang xóa toàn bộ tri thức của Agent: {agent_id}")
    
    async def _run():
        try:
            from app.models.base import AsyncSessionLocal
            from app.models.agent import Agent
            from sqlalchemy import select
            
            agent_name = "Deleted Agent"
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(Agent).where(Agent.id == agent_id))
                agent_obj = result.scalar_one_or_none()
                if agent_obj:
                    agent_name = agent_obj.name

            service = GraphRAGService(
                llm=None, 
                embedding_config={"provider": "google", "model": "models/embedding-001"},
                agent_id=agent_id,
                agent_name=agent_name
            )
            
            await service.delete_agent_graph()
            logger.info(f"✅ Đã xóa xong toàn bộ tri thức Agent {agent_id}")
        except Exception as e:
            logger.error(f"❌ Worker gặp lỗi khi xóa tri thức Agent: {str(e)}")

    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(_run())

@celery_app.task(name="app.tasks.graph_rag.index_datasource_task")
def index_datasource_task(ds_id: str):
    """
    Celery task để introspect database schema và nạp vào GraphRAG.
    """
    logger.info(f"👷 Worker đang lập chỉ mục cho Datasource: {ds_id}")
    
    async def _run():
        from app.models.base import AsyncSessionLocal
        from app.models.datasource import DataSource
        from app.models.semantic import SemanticTable, SemanticColumn, SemanticRelationship
        from app.services.duckdb_service import DuckDBService
        from app.services.powerbi_service import PowerBIService
        from app.services.graph_rag_service import GraphRAGService
        from app.core.security import decrypt_password
        from sqlalchemy import select, delete as sa_delete
        
        async with AsyncSessionLocal() as db:
            try:
                # 1. Lấy thông tin Datasource
                result = await db.execute(select(DataSource).where(DataSource.id == ds_id))
                ds = result.scalar_one_or_none()
                if not ds:
                    logger.error(f"❌ Không tìm thấy Datasource {ds_id}")
                    return

                plain_pw = decrypt_password(ds.encrypted_password)
                alias = ds.name.replace(" ", "_").lower()
                
                # 2. Xóa dữ liệu cũ
                await db.execute(sa_delete(SemanticTable).where(SemanticTable.datasource_id == ds_id))
                await db.execute(sa_delete(SemanticRelationship).where(SemanticRelationship.datasource_id == ds_id))
                await db.commit()

                tables_out = []
                relationships_out = []
                x, y = 50.0, 50.0

                # 3. Introspect Schema
                if ds.engine.lower() == "powerbi":
                    token = await PowerBIService.get_access_token(ds.host, ds.username, plain_pw)
                    workspace_id = ds.extra_params.get("workspace_id") if ds.extra_params else ds.port
                    dataset_id = ds.extra_params.get("dataset_id") if ds.extra_params else ds.database
                    schema = await PowerBIService.introspect_schema(str(workspace_id), str(dataset_id), token)
                    
                    for tname, columns in schema.items():
                        sem_table = SemanticTable(datasource_id=ds_id, name=tname, pos_x=x, pos_y=y)
                        db.add(sem_table)
                        await db.flush()
                        
                        cols = []
                        for col in columns:
                            sem_col = SemanticColumn(
                                table_id=sem_table.id,
                                name=col["name"],
                                data_type=col["type"],
                                is_primary_key=False,
                                is_nullable=not col.get("hidden", False)
                            )
                            db.add(sem_col)
                            cols.append(sem_col)
                        
                        await db.flush()
                        tables_out.append({"id": sem_table.id, "name": tname, "description": "", "columns": cols})
                        x += 320
                        if x > 1200: x = 50; y += 260
                else:
                    host = ds.host
                    # Xử lý vấn đề Docker networking: FastAPI chạy ngoài host gọi localhost, nhưng Celery chạy trong Docker
                    if host in ["localhost", "127.0.0.1"]:
                        host = "host.docker.internal"
                        
                    ds_dict = {
                        "engine": ds.engine, "name": ds.name, "host": host, "port": ds.port,
                        "username": ds.username, "plain_password": plain_pw, "database": ds.database, "ssl": ds.ssl,
                    }
                    schema_filter = ds.schema_name or "public"
                    
                    with DuckDBService.execution_context([ds_dict]) as conn:
                        table_query = f"SELECT table_name FROM information_schema.tables WHERE table_catalog = '{alias}' AND table_schema = '{schema_filter}'"
                        table_names = [r[0] for r in conn.execute(table_query).fetchall()]
                        
                        for tname in table_names:
                            sem_table = SemanticTable(datasource_id=ds_id, name=tname, pos_x=x, pos_y=y)
                            db.add(sem_table)
                            await db.flush()
                            
                            # 3.2. Lấy thông tin cột qua information_schema (Chuẩn hơn PRAGMA cho external DB)
                            col_query = f"""
                                SELECT column_name, data_type, is_nullable, column_default
                                FROM "{alias}".information_schema.columns
                                WHERE table_schema = '{schema_filter}' AND table_name = '{tname}'
                                ORDER BY ordinal_position
                            """
                            col_data = conn.execute(col_query).fetchall()
                            
                            cols = []
                            for c in col_data:
                                # c[0]: name, c[1]: type, c[2]: is_nullable
                                sem_col = SemanticColumn(
                                    table_id=sem_table.id, 
                                    name=c[0], 
                                    data_type=str(c[1]),
                                    is_primary_key=False, # Sẽ được cập nhật nếu logic PK cần thiết
                                    is_nullable=c[2].lower() == 'yes',
                                )
                                db.add(sem_col)
                                cols.append(sem_col)
                            
                            await db.flush()
                            tables_out.append({"id": sem_table.id, "name": tname, "description": "", "columns": cols})
                            x += 320
                            if x > 1200: x = 50; y += 260
                        
                        if ds.engine.lower() in ["postgres", "postgresql"]:
                            # 3.3. Trích xuất Foreign Keys chuẩn PostgreSQL
                            fk_query = f"""
                                SELECT 
                                    tc.table_name AS from_table, 
                                    kcu.column_name AS from_column, 
                                    ccu.table_name AS to_table,
                                    ccu.column_name AS to_column 
                                FROM 
                                    "{alias}".information_schema.table_constraints AS tc 
                                    JOIN "{alias}".information_schema.key_column_usage AS kcu
                                      ON tc.constraint_name = kcu.constraint_name
                                      AND tc.table_schema = kcu.table_schema
                                    JOIN "{alias}".information_schema.constraint_column_usage AS ccu
                                      ON ccu.constraint_name = tc.constraint_name
                                      AND ccu.table_schema = tc.table_schema
                                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = '{schema_filter}'
                            """
                            try:
                                fks = conn.execute(fk_query).fetchall()
                                for from_t, from_c, to_t, to_c in fks:
                                    from_table_obj = next((t for t in tables_out if t["name"] == from_t), None)
                                    to_table_obj = next((t for t in tables_out if t["name"] == to_t), None)
                                    
                                    if from_table_obj and to_table_obj:
                                        rel = SemanticRelationship(
                                            datasource_id=ds_id, from_table_id=from_table_obj["id"],
                                            from_column=from_c, to_table_id=to_table_obj["id"],
                                            to_column=to_c, relation_type="Many-to-one"
                                        )
                                        db.add(rel)
                                        relationships_out.append({
                                            "from_table": from_t, "from_table_id": from_table_obj["id"],
                                            "from_column": from_c, "to_table": to_t, "to_table_id": to_table_obj["id"],
                                            "to_column": to_c
                                        })
                                await db.flush()
                            except Exception as e:
                                logger.warning(f"⚠️ Không thể trích xuất foreign keys: {e}")
                                
                await db.commit()

                # 4. Index vào GraphRAG (Structured Mode)
                extra = ds.extra_params or {}
                agent_id = extra.get("agent_id")
                
                embedding_config = {}
                chat_api_key = None
                chat_provider = None

                # Lấy cấu hình từ Agent nếu có agent_id
                if agent_id and agent_id != "temp":
                    from app.models.agent import Agent
                    from sqlalchemy import select
                    
                    from app.core.security import decrypt_password
                    
                    agent_result = await db.execute(select(Agent).where(Agent.id == agent_id))
                    agent_obj = agent_result.scalar_one_or_none()
                    if agent_obj:
                        embedding_config = {
                            "provider": agent_obj.embedding_provider,
                            "model": agent_obj.embedding_model,
                            "api_key": decrypt_password(agent_obj.embedding_api_key) if agent_obj.embedding_api_key else None
                        }
                        chat_api_key = decrypt_password(agent_obj.api_key) if agent_obj.api_key else None
                        chat_provider = agent_obj.model_provider
                        chat_model_name = agent_obj.model_name

                # Fallback nếu không có Agent hoặc là agent "temp"
                if not embedding_config:
                    embedding_config = {
                        "provider": extra.get("embedding_provider"),
                        "model": extra.get("embedding_model"),
                        "api_key": extra.get("embedding_api_key")
                    }
                    chat_api_key = extra.get("chat_api_key")
                    chat_provider = extra.get("chat_provider")
                    chat_model_name = extra.get("model_name")

                graph_rag = GraphRAGService(
                    embedding_config=embedding_config,
                    chat_api_key=chat_api_key,
                    chat_provider=chat_provider,
                    chat_model_name=chat_model_name,
                    agent_id=agent_id,
                    agent_name=agent_obj.name if agent_obj else "agent",
                    collection_type="semantic"
                )
                
                # Nạp Schema trực tiếp (Chính xác 100%, cực nhanh)
                await graph_rag.index_structured_schema(tables_out, relationships_out, ds.name, ds_id)

                logger.info(f"✅ Đã hoàn thành lập chỉ mục Schema Chính xác cho {ds_id} qua Celery.")

                logger.info(f"✅ Đã hoàn thành lập chỉ mục Semantic & Relationships cho {ds_id} qua Celery.")
            except Exception as e:
                logger.error(f"❌ Lỗi Celery Task Indexing Datasource: {str(e)}")
                await db.rollback()

    # Chạy async
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())
