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
            service = GraphRAGService(
                llm=llm, 
                embedding_config={
                    "provider": embedding_provider,
                    "model": embedding_model,
                    "api_key": embedding_api_key
                },
                chat_api_key=api_key,
                chat_provider=provider
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
def delete_document_task(file_url: str, embedding_provider: str = "google", embedding_model: str = "models/embedding-001"):
    """
    Celery task để xóa tri thức liên quan đến một file khỏi GraphRAG.
    """
    logger.info(f"🧹 Worker đang dọn dẹp tri thức cho file: {file_url}")
    
    async def _run():
        try:
            # Khởi tạo service với config để biết collection nào cần xóa
            service = GraphRAGService(
                llm=None, 
                embedding_config={
                    "provider": embedding_provider,
                    "model": embedding_model
                },
                chat_api_key=None, # Khi xóa không cần LLM key
                chat_provider=None
            )
            
            # 1. Xóa Node đại diện cho tài liệu (Ví dụ LangChain lưu ID tài liệu theo biến source)
            cypher_delete_doc = """
            MATCH (d:Document) WHERE d.id = $url OR d.source = $url
            DETACH DELETE d
            """
            service.graph.query(cypher_delete_doc, params={"url": file_url})
            
            # 2. Xóa các Entity bị "mồ côi" (Không còn bất kỳ Relationship nào)
            cypher_cleanup_orphans = """
            MATCH (n)
            WHERE NOT (n)-[]-() 
            DELETE n
            """
            service.graph.query(cypher_cleanup_orphans)
            
            # Logic xóa trong Qdrant: Xóa theo filter metadata
            from qdrant_client.http import models
            
            # Tên collection dựa trên model
            model_slug = embedding_model.replace("/", "_").replace("-", "_")
            collection_name = f"kb_{model_slug}"
            
            service.qdrant_client.delete(
                collection_name=collection_name,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="metadata.file_url",
                                match=models.MatchValue(value=file_url),
                            ),
                        ]
                    )
                ),
            )
            logger.info(f"✅ Đã dọn dẹp xong toàn bộ tri thức của {file_url} trong {collection_name}")
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
