import os
import asyncio
from typing import List, Dict, Any
from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from langchain_neo4j import Neo4jGraph
from langchain_qdrant import QdrantVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_experimental.graph_transformers import LLMGraphTransformer
from langchain_core.documents import Document
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class GraphRAGService:
    def __init__(self, llm=None, embedding_config: dict = None, chat_api_key: str = None, chat_provider: str = None):
        self.llm = llm
        
        # Kết nối Neo4J
        logger.info(f"🔗 Đang kết nối Neo4J tại {settings.NEO4J_URI} với user {settings.NEO4J_USER}...")
        self.graph = Neo4jGraph(
            url=settings.NEO4J_URI,
            username=settings.NEO4J_USER,
            password=settings.NEO4J_PASSWORD,
            sanitize=True,  # Tắt cảnh báo apoc.create.addLabels deprecated
        )
        
        # Kết nối Qdrant
        self.qdrant_client = QdrantClient(
            url=settings.QDRANT_URL
        )
        
        # Khởi tạo Embeddings
        provider = (embedding_config or {}).get("provider", "google").lower()
        model = (embedding_config or {}).get("model", "models/embedding-001")
        
        # Chuẩn hóa chat provider
        chat_provider_norm = (chat_provider or "").lower()
        
        # Lấy API Key từ config, nếu là chuỗi rỗng thì coi như None để dùng key hệ thống
        api_key = (embedding_config or {}).get("api_key")
        
        logger.info(f"🔍 Kiểm tra Key: Provider={provider}, ChatProvider={chat_provider_norm}, HasEmbKey={bool(api_key)}, HasChatKey={bool(chat_api_key)}")

        if not api_key: # Xử lý cả None và ""
            # Thử dùng Key của model Chat nếu cùng Provider (ví dụ cùng là 'google')
            if provider == chat_provider_norm and chat_api_key:
                api_key = chat_api_key
                logger.info(f"🔑 Đã mượn API Key từ model Chat cho {provider}")
            else:
                logger.warning(f"⚠️ Không tìm thấy API Key cho {provider} (ChatKey={bool(chat_api_key)})")
        
        if provider == "google":
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            # Chuẩn hóa tên model cho Google
            if model and "embedding-001" in model and "gemini" not in model:
                normalized_model = "models/gemini-embedding-001"
            elif model:
                normalized_model = model if model.startswith("models/") else f"models/{model}"
            else:
                normalized_model = "models/text-embedding-004"
            
            logger.info(f"🧬 Khởi tạo Google Embeddings (2026 Mode): {normalized_model}")
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=normalized_model,
                google_api_key=api_key,
            )
        elif provider == "openai":
            from langchain_openai import OpenAIEmbeddings
            self.embeddings = OpenAIEmbeddings(
                model=model if model != "models/embedding-001" else "text-embedding-3-small",
                openai_api_key=api_key
            )
        elif provider == "ollama":
            from langchain_community.embeddings import OllamaEmbeddings
            self.embeddings = OllamaEmbeddings(
                base_url=settings.OLLAMA_URL,
                model=model if model != "models/embedding-001" else "llama3"
            )
        else:
            # Mặc định dùng Google nếu không khớp, nhưng vẫn dùng api_key của người dùng
            from langchain_google_genai import GoogleGenerativeAIEmbeddings
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=api_key
            )
        
        # Transformer để trích xuất Graph từ văn bản (Chỉ khi có LLM)
        if self.llm:
            from langchain_experimental.graph_transformers import LLMGraphTransformer
            
            # 🇻🇳 Chỉ dẫn SIÊU NGHIÊM NGẶT về Tiếng Việt
            vietnamese_instructions = (
                "BẮT BUỘC: Toàn bộ tên thực thể và loại mối quan hệ PHẢI là Tiếng Việt. "
                "Ví dụ: Thay vì 'MEMBER_OF', hãy dùng 'LÀ_THÀNH_VIÊN_CỦA'. "
                "Tập trung vào nội dung quan trọng, loại bỏ các ký tự kỹ thuật JSON rác."
            )
            
            # Nếu self.llm là Provider wrapper của chúng ta, lấy model LangChain bên trong (thuộc tính client)
            actual_llm = getattr(self.llm, "client", self.llm)
            self.graph_transformer = LLMGraphTransformer(
                llm=actual_llm,
                additional_instructions=vietnamese_instructions,
                node_properties=False,
                relationship_properties=False
            )

    async def process_document(self, content: str, metadata: Dict[str, Any] = None):
        """
        Xử lý tài liệu: Trích xuất Graph (đoạn lớn) và lưu Vector (đoạn nhỏ).
        """
        logger.info("📄 Đang bắt đầu quy trình Hybrid GraphRAG Ingestion...")
        
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        # 1. Cắt văn bản cho Graph và Vector chung 1 lần để tối ưu CPU (Tăng lên 4000 để giảm số lượng request)
        graph_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
        graph_chunks = graph_splitter.split_text(content)
        graph_docs = [Document(page_content=chunk, metadata=metadata or {}) for chunk in graph_chunks]
        
        # 2. Dùng chung docs cho vector
        vector_docs = graph_docs
        
        # --- BƯỚC A: TRÍCH XUẤT GRAPH (SỬ DỤNG ĐOẠN LỚN HƠN) ---
        logger.info(f"🧠 Trích xuất Graph từ {len(graph_docs)} đoạn (chunk_size=4000)...")
        # Tăng concurrency lên 5 để xử lý song song, giúp tăng tốc độ nạp dữ liệu
        semaphore = asyncio.Semaphore(5)
        
        async def sem_process(doc, index, total):
            async with semaphore:
                logger.info(f"🧩 Đang xử lý đoạn {index}/{total}...")
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        # Hỗ trợ cả phiên bản cũ (sync) và mới (async) của LangChain
                        if hasattr(self.graph_transformer, 'aconvert_to_graph_documents'):
                            logger.info(f"🤖 [Chunk {index}] Đang gọi LLM (async)...")
                            coro = self.graph_transformer.aconvert_to_graph_documents([doc])
                        else:
                            logger.info(f"🤖 [Chunk {index}] Đang gọi LLM (via thread)...")
                            coro = asyncio.to_thread(self.graph_transformer.convert_to_graph_documents, [doc])
                        
                        # Tăng timeout lên 240s
                        res = await asyncio.wait_for(coro, timeout=240.0)
                        
                        if res:
                            logger.info(f"✨ [Chunk {index}] LLM trả về {len(res[0].nodes)} nodes và {len(res[0].relationships)} relations")
                            return res[0]
                        else:
                            logger.warning(f"❓ [Chunk {index}] LLM không tìm thấy thực thể nào.")
                            return None
                    except asyncio.TimeoutError:
                        wait_s = (attempt + 1) * 10
                        logger.warning(f"⏱️ Timeout đoạn {index} lần {attempt + 1}/{max_retries}. Thử lại sau {wait_s}s...")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(wait_s)
                        else:
                            logger.error(f"⚠️ Lỗi trích xuất Graph đoạn {index} (TimeoutError): Bỏ qua sau {max_retries} lần thử")
                            return None
                    except Exception as e:
                        error_type = type(e).__name__
                        logger.error(f"⚠️ Lỗi trích xuất Graph đoạn {index} ({error_type}): {str(e)}")
                        return None
        
        tasks = []
        for i, doc in enumerate(graph_docs):
            tasks.append(sem_process(doc, i + 1, len(graph_docs)))
        
        results = await asyncio.gather(*tasks)
        
        # Lọc bỏ các kết quả None và LỌC RÁC JSON
        graph_documents = []
        for res in results:
            if res is not None:
                # Chỉ giữ các node không chứa ký tự rác JSON
                res.nodes = [n for n in res.nodes if not any(c in n.id for c in ['{', '}', '[', ']', ':'])]
                res.relationships = [r for r in res.relationships if not any(c in r.source.id or c in r.target.id for c in ['{', '}', '[', ']', ':'])]
                graph_documents.append(res)
        
        logger.info(f"✨ Trích xuất xong {len(graph_documents)} sơ đồ. Đang lưu vào Neo4J...")
        self.graph.add_graph_documents(graph_documents, baseEntityLabel=True, include_source=True)
        
        # --- BƯỚC B: LƯU VECTOR (SỬ DỤNG ĐOẠN NHỎ) ---
        emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "text-embedding-004"))
        # Chuẩn hóa: Luôn đảm bảo có tiền tố gemini- nếu là model google để khớp với Ingestion task
        model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
        if "embedding_001" in model_slug and "gemini_" not in model_slug:
            model_slug = f"gemini_{model_slug}"
            
        collection_name = f"kb_{model_slug}"
        
        # Xác định số chiều (Dimensions)
        # text-embedding-004 mặc định là 3072, embedding-001 là 768
        vector_size = 3072 if "004" in emb_model or "preview" in emb_model else 768
        
        logger.info(f"📍 Đang chuẩn bị Qdrant collection: {collection_name} (Size: {vector_size})...")
        try:
            # Kiểm tra collection
            from qdrant_client.http import models as qmodels
            
            # Kiểm tra xem collection đã tồn tại chưa
            exists = False
            try:
                collection_info = self.qdrant_client.get_collection(collection_name)
                exists = True
                # Kiểm tra xem kích thước vector có khớp không
                current_size = collection_info.config.params.vectors.size
                if current_size != vector_size:
                    logger.warning(f"⚠️ Kích thước vector không khớp ({current_size} != {vector_size}). Đang xóa và tạo lại...")
                    self.qdrant_client.delete_collection(collection_name)
                    exists = False
            except Exception:
                exists = False

            if not exists:
                logger.info(f"🆕 Tạo collection mới: {collection_name} với size {vector_size}")
                self.qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
                )
            
            logger.info(f"🚀 Đang nhúng và lưu {len(vector_docs)} đoạn nhỏ vào Qdrant...")
            await QdrantVectorStore.afrom_documents(
                vector_docs,
                self.embeddings,
                url=settings.QDRANT_URL,
                collection_name=collection_name,
                force_recreate=not exists
            )
            logger.info(f"✅ Đã lưu xong {len(vector_docs)} vectors đoạn nhỏ.")
        except Exception as e:
            logger.error(f"❌ Lỗi lưu Qdrant: {str(e)}")
            
        logger.info("✅ Hoàn tất nạp tài liệu Hybrid GraphRAG.")

    async def query(self, user_query: str) -> str:
        """
        Truy vấn kết hợp Graph (Neo4J) + Vector (Qdrant).
        """
        logger.info(f"🔍 Bắt đầu truy vấn Hybrid GraphRAG cho: {user_query}")
        
        try:
            # Tên collection dựa trên model (Chuẩn hóa khớp với Ingestion)
            emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "default"))
            model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
            if "embedding_001" in model_slug and "gemini_" not in model_slug:
                model_slug = f"gemini_{model_slug}"
                
            collection_name = f"kb_{model_slug}"
            
            # 1. Tìm kiếm Vector Context từ Qdrant
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=collection_name,
                embedding=self.embeddings
            )
            vector_results = vector_store.similarity_search(user_query, k=3)
            vector_context = "\n".join([doc.page_content for doc in vector_results])
            
            # 2. Tìm kiếm Graph Context từ Neo4J
            graph_context = ""
            
            # 2.1 Ép LLM trả về định dạng mảng (Array) rõ ràng
            entities_query = (
                f"Trích xuất các danh từ riêng/thực thể từ câu hỏi sau. "
                f"BẮT BUỘC CHỈ TRẢ VỀ các từ cách nhau bằng dấu phẩy, không thêm bất kỳ từ ngữ nào khác. "
                f"Câu hỏi: {user_query}"
            )
            entities_res = await self.llm.ainvoke(entities_query)
            
            # Xử lý chuỗi trả về để lấy list sạch
            raw_content = str(entities_res.content).replace("'", "").replace('"', '')
            entities = [e.strip().lower() for e in raw_content.split(",") if len(e.strip()) > 1]
            
            if entities:
                # 2.2 Đổi Cypher: Dùng toLower() và ANY() để khớp từ khóa linh hoạt hơn
                cypher = """
                MATCH (n)-[r]->(m)
                WHERE ANY(e IN $entities WHERE toLower(n.id) CONTAINS e OR toLower(m.id) CONTAINS e)
                RETURN n.id + ' -- ' + type(r) + ' --> ' + m.id as relationship
                LIMIT 15
                """
                try:
                    graph_data = self.graph.query(cypher, params={"entities": entities})
                    graph_context = "\n".join([row['relationship'] for row in graph_data])
                except Exception as e:
                    logger.warning(f"⚠️ Lỗi truy vấn Cypher: {str(e)}")
            
            # 3. Kết hợp và trả về kết quả cuối cùng
            full_context = f"DỮ LIỆU VECTOR:\n{vector_context}\n\nDỮ LIỆU ĐỒ THỊ (RELATIONSHIPS):\n{graph_context}"
            
            final_prompt = (
                "Dựa trên các thông tin thu thập được từ hệ thống GraphRAG dưới đây, hãy trả lời câu hỏi của người dùng một cách chính xác nhất.\n"
                "Nếu thông tin từ Đồ thị và Vector mâu thuẫn, hãy ưu tiên thông tin từ Đồ thị (Graph).\n\n"
                f"NGỮ CẢNH:\n{full_context}\n\n"
                f"CÂU HỎI: {user_query}"
            )
            
            response = await self.llm.ainvoke(final_prompt)
            return response.content
            
        except Exception as e:
            logger.error(f"❌ Lỗi trong quá trình Hybrid Query: {str(e)}")
            return f"Lỗi truy vấn tri thức: {str(e)}"
