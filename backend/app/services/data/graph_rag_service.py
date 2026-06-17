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
    def __init__(self, llm=None, embedding_config: dict = None, chat_api_key: str = None, chat_provider: str = None, chat_model_name: str = None, agent_id: str = None, agent_name: str = None, collection_type: str = "kb"):
        self.llm = llm
        self.agent_id = agent_id
        self.agent_name = agent_name or "agent"
        self.collection_type = collection_type or "kb"
        
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
        provider = (embedding_config or {}).get("provider") or "google"
        provider = provider.lower()
        model = (embedding_config or {}).get("model") or "models/embedding-001"
        
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
            elif provider == "google" and getattr(settings, "GOOGLE_API_KEY", None):
                api_key = settings.GOOGLE_API_KEY
                logger.info(f"🔑 Sử dụng GOOGLE_API_KEY từ cấu hình hệ thống")
            else:
                logger.warning(f"⚠️ Không tìm thấy API Key cho {provider} (ChatKey={bool(chat_api_key)})")
                raise ValueError(f"Chưa cấu hình API Key cho mô hình nhúng '{provider}'. Hãy đảm bảo Datasource này đã được gắn vào một Agent có cấu hình API Key, hoặc thêm cấu hình mặc định vào file .env!")
        
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
            emb_kwargs = {"model": normalized_model}
            if api_key:
                emb_kwargs["google_api_key"] = api_key
            
            self.embeddings = GoogleGenerativeAIEmbeddings(**emb_kwargs)
        elif provider == "openai":
            from langchain_openai import OpenAIEmbeddings
            emb_kwargs = {"model": model if model != "models/embedding-001" else "text-embedding-3-small"}
            if api_key:
                emb_kwargs["openai_api_key"] = api_key
            self.embeddings = OpenAIEmbeddings(**emb_kwargs)
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
        
        # Khởi tạo LLM nếu chưa có (Dùng cho các tác vụ bổ trợ như trích xuất thực thể, tổng hợp context)
        if not self.llm and chat_api_key:
            from app.agents.factory import get_model
            # Sử dụng đúng model mà người dùng đã cấu hình cho Agent
            self.llm = get_model(
                chat_provider_norm or "openai",
                chat_model_name or ("gpt-4o" if chat_provider_norm == "openai" else "gemini-1.5-flash"),
                api_key=chat_api_key,
                streaming=False # Vẫn giữ False để tránh lỗi SDK khi xử lý nội bộ
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
        else:
            self.graph_transformer = None
            logger.warning("⚠️ Không thể khởi tạo LLMGraphTransformer vì thiếu LLM.")

        # Tăng concurrency lên 5 để xử lý song song, giúp tăng tốc độ nạp dữ liệu
        # Đặt ở level instance để dùng chung cho tất cả các lần gọi process_document (ví dụ khi index nhiều table)
        self.semaphore = asyncio.Semaphore(5)

    async def process_document(self, content: str, metadata: Dict[str, Any] = None):
        """
        Xử lý tài liệu: Trích xuất Graph (đoạn lớn) và lưu Vector (đoạn nhỏ).
        """
        logger.info(f"📄 Đang bắt đầu quy trình Hybrid GraphRAG Ingestion (Type={self.collection_type})...")
        
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        
        # 1. Cắt văn bản cho Graph và Vector chung 1 lần để tối ưu CPU (Tăng lên 4000 để giảm số lượng request)
        graph_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
        graph_chunks = graph_splitter.split_text(content)
        graph_docs = [Document(page_content=chunk, metadata=metadata or {}) for chunk in graph_chunks]
        
        # 2. Dùng chung docs cho vector
        vector_docs = graph_docs
        
        # --- BƯỚC A: TRÍCH XUẤT GRAPH (SỬ DỤNG ĐOẠN LỚN HƠN) ---
        logger.info(f"🧠 Trích xuất Graph từ {len(graph_docs)} đoạn (chunk_size=4000)...")
        
        async def sem_process(doc, index, total):
            async with self.semaphore:
                if not self.graph_transformer:
                    logger.warning(f"⏭️ Bỏ qua trích xuất Graph cho đoạn {index} vì không có LLM.")
                    return None
                    
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
        
        # --- CÔ LẬP DỮ LIỆU THEO AGENT TRONG NEO4J ---
        prefix = f"agent_{self.agent_id}:"
        for res in graph_documents:
            # Cô lập node Document nguồn
            source_id = res.source.metadata.get("source", "unknown")
            if not str(source_id).startswith("agent_"):
                res.source.metadata["source"] = f"{prefix}{source_id}"
            res.source.metadata["agent_id"] = str(self.agent_id)
            
            for node in res.nodes:
                if not node.id.startswith("agent_"):
                    node.id = f"{prefix}{node.id}"
                # Thêm property agent_id để dễ quản lý/xóa
                node.properties["agent_id"] = str(self.agent_id)
                node.properties["source_id"] = res.source.metadata.get("source")
                
            for rel in res.relationships:
                if not rel.source.id.startswith("agent_"):
                    rel.source.id = f"{prefix}{rel.source.id}"
                if not rel.target.id.startswith("agent_"):
                    rel.target.id = f"{prefix}{rel.target.id}"
                # Thêm property agent_id cho quan hệ
                rel.properties["agent_id"] = str(self.agent_id)
        
        self.graph.add_graph_documents(graph_documents, baseEntityLabel=True, include_source=True)
        
        # --- BƯỚC B: LƯU VECTOR (SỬ DỤNG ĐOẠN NHỎ) ---
        emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "text-embedding-004"))
        # Chuẩn hóa: Luôn đảm bảo có tiền tố gemini- nếu là model google để khớp với Ingestion task
        model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
        if "embedding_001" in model_slug and "gemini_" not in model_slug:
            model_slug = f"gemini_{model_slug}"
            
        # Tên collection độc nhất cho mỗi Agent và Loại dữ liệu
        import re
        if self.collection_type == "semantic":
            friendly_name = "schema"
        else:
            friendly_name = re.sub(r'[^a-z0-9]', '_', self.agent_name.lower())[:20]
            
        short_id = str(self.agent_id).split("-")[0] if self.agent_id else "global"
        collection_name = f"{self.collection_type}_{friendly_name}_{short_id}_{model_slug}"
        
        # 📏 Phát hiện số chiều thực tế (Dimensions)
        try:
            sample_emb = await self.embeddings.aembed_query("test dimension")
            vector_size = len(sample_emb)
            logger.info(f"📏 [File] Đã phát hiện số chiều thực tế: {vector_size}")
        except Exception as e:
            logger.warning(f"⚠️ Không thể phát hiện số chiều, dùng fallback: {e}")
            vector_size = 3072 if "004" in emb_model or "preview" in emb_model else 768
        
        logger.info(f"📍 Đang chuẩn bị Qdrant collection: {collection_name} (Size: {vector_size})...")
        try:
            from qdrant_client.http import models as qmodels
            
            # Kiểm tra xem collection đã tồn tại chưa
            recreate = False
            if self.qdrant_client.collection_exists(collection_name):
                try:
                    collection_info = self.qdrant_client.get_collection(collection_name)
                    # Lấy size hiện tại
                    v_config = collection_info.config.params.vectors
                    current_size = 0
                    if hasattr(v_config, 'size'):
                        current_size = v_config.size
                    elif isinstance(v_config, dict) and v_config:
                        current_size = next(iter(v_config.values())).size
                    
                    if current_size != vector_size:
                        logger.warning(f"⚠️ Kích thước vector không khớp ({current_size} != {vector_size}). Đang tạo lại...")
                        self.qdrant_client.delete_collection(collection_name)
                        recreate = True
                except Exception as e:
                    logger.error(f"❌ Lỗi khi kiểm tra collection: {e}")
                    recreate = True
            else:
                recreate = True

            if recreate:
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
                force_recreate=recreate
            )
            logger.info(f"✅ Đã lưu xong {len(vector_docs)} vectors đoạn nhỏ.")
        except Exception as e:
            logger.error(f"❌ Lỗi lưu Qdrant: {str(e)}")
            
        logger.info("✅ Hoàn tất nạp tài liệu Hybrid GraphRAG.")

    async def index_structured_schema(self, tables: List[Dict], relationships: List[Dict], datasource_name: str, datasource_id: str):
        """
        Nạp trực tiếp cấu trúc Schema vào Neo4J và Qdrant mà không qua LLM extraction
        để đảm bảo độ chính xác 100% cho các bảng, cột và quan hệ.
        """
        logger.info(f"🏗️ Đang nạp cấu trúc Schema cho {datasource_name} (ID: {datasource_id}) vào GraphRAG...")
        
        # 1. Neo4J: Tạo các Node và Relationship chuẩn
        table_count = 0
        column_count = 0
        prefix = f"agent_{self.agent_id}:"
        
        for table in tables:
            tname = table['name']
            tdesc = getattr(table, 'description', table.get('description', ""))
            columns = table.get('columns', [])
            # Gắn prefix để cô lập theo Agent
            table_id = f"{prefix}{datasource_name}.{tname}"
            table_count += 1
            
            logger.info(f"📊 [Neo4J] Đang xử lý bảng: {tname} ({len(columns)} cột)")
            
            # Tạo hoặc cập nhật Bảng và Cột đồng thời
            for col in columns:
                # Lấy thuộc tính an toàn (hỗ trợ cả SQLAlchemy objects và dicts)
                cname = getattr(col, 'name', col.get('name') if isinstance(col, dict) else None)
                ctype = getattr(col, 'data_type', col.get('data_type') if isinstance(col, dict) else "unknown")
                is_pk = getattr(col, 'is_primary_key', col.get('is_primary_key') if isinstance(col, dict) else False)
                cdesc = getattr(col, 'description', col.get('description') if isinstance(col, dict) else "")
                
                if not cname:
                    continue
                
                column_count += 1
                col_id = f"{prefix}{datasource_name}.{tname}.{cname}"
                
                # MERGE bảng, MERGE cột và MERGE quan hệ trong 1 block để đảm bảo tính nguyên tử
                cypher_combined = """
                MERGE (t:Table {id: $table_id})
                SET t.name = $tname, t.datasource_id = $ds_id, t.datasource_name = $ds_name, t.description = $tdesc
                MERGE (c:Column {id: $col_id})
                SET c.name = $cname, c.type = $ctype, c.is_pk = $is_pk, c.description = $cdesc
                MERGE (t)-[:HAS_COLUMN]->(c)
                """
                try:
                    self.graph.query(cypher_combined, params={
                        "table_id": table_id, "tname": tname, "ds_id": datasource_id, "ds_name": datasource_name, "tdesc": tdesc,
                        "col_id": col_id, "cname": cname, "ctype": str(ctype), "is_pk": bool(is_pk), "cdesc": cdesc
                    })
                except Exception as e:
                    logger.error(f"❌ Lỗi khi nạp cột {cname} của bảng {tname}: {e}")
        
        # Tạo các mối quan hệ Foreign Key
        rel_count = 0
        for rel in relationships:
            from_t = rel.get('from_table')
            from_c = rel.get('from_column')
            to_t = rel.get('to_table')
            to_c = rel.get('to_column')
            
            if not all([from_t, from_c, to_t, to_c]):
                continue
                
            from_id = f"{prefix}{datasource_name}.{from_t}.{from_c}"
            to_id = f"{prefix}{datasource_name}.{to_t}.{to_c}"
            
            # Tách thành 2 lệnh MATCH để tránh cảnh báo Cartesian Product
            cypher_rel = """
            MATCH (fc:Column {id: $from_id})
            MATCH (tc:Column {id: $to_id})
            MERGE (fc)-[:REFERENCES]->(tc)
            """
            try:
                self.graph.query(cypher_rel, params={"from_id": from_id, "to_id": to_id})
                rel_count += 1
            except Exception as e:
                logger.error(f"❌ Lỗi khi nạp quan hệ {from_t}.{from_c} -> {to_t}.{to_c}: {e}")

        logger.info(f"✨ [Neo4J] Đã nạp xong: {table_count} bảng, {column_count} cột, {rel_count} quan hệ.")

        # 2. Qdrant: Nạp text để search semantic
        vector_docs = []
        for table in tables:
            tname = table['name']
            tdesc = getattr(table, 'description', table.get('description', ""))
            
            content = f"Bảng '{tname}' trong nguồn dữ liệu '{datasource_name}'. "
            if tdesc:
                content += f"Mô tả bảng: {tdesc}. "
            
            content += "Danh sách các cột: "
            column_parts = []
            for c in table.get('columns', []):
                name = getattr(c, 'name', c.get('name') if isinstance(c, dict) else "unknown")
                desc = getattr(c, 'description', c.get('description') if isinstance(c, dict) else "")
                if name:
                    col_info = f"{name}"
                    if desc:
                        col_info += f" ({desc})"
                    column_parts.append(col_info)
            
            content += ", ".join(column_parts)
            
            vector_docs.append(Document(
                page_content=content, 
                metadata={"type": "semantic_layer", "datasource_id": datasource_id, "table_name": tname}
            ))
            
        if vector_docs:
            # Phát hiện số chiều thực tế từ model embeddings
            try:
                sample_emb = await self.embeddings.aembed_query("test dimension")
                vector_size = len(sample_emb)
                logger.info(f"📏 Phát hiện số chiều vector: {vector_size}")
            except Exception as e:
                logger.warning(f"⚠️ Không thể phát hiện số chiều vector, dùng mặc định: {e}")
                vector_size = 768

            emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "text-embedding-004"))
            model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
            friendly_name = "schema" # Dùng tên chung cho schema để dễ quản lý
            short_id = str(self.agent_id).split("-")[0] if self.agent_id else "global"
            collection_name = f"semantic_{friendly_name}_{short_id}_{model_slug}"
            
            # Kiểm tra và tạo/tạo lại collection nếu sai số chiều
            from qdrant_client.http import models as qmodels
            recreate = False
            
            if self.qdrant_client.collection_exists(collection_name):
                info = self.qdrant_client.get_collection(collection_name)
                # Lấy size hiện tại (hỗ trợ cả dict và object config)
                current_size = 0
                v_config = info.config.params.vectors
                if hasattr(v_config, 'size'):
                    current_size = v_config.size
                elif isinstance(v_config, dict) and v_config:
                    # Nếu là dict (đa vector), lấy key đầu tiên
                    first_vector = next(iter(v_config.values()))
                    current_size = getattr(first_vector, 'size', None)
                
                if current_size != vector_size:
                    logger.warning(f"⚠️ Collection {collection_name} có size {current_size} nhưng model trả về {vector_size}. Đang tạo lại...")
                    self.qdrant_client.delete_collection(collection_name)
                    recreate = True
            else:
                recreate = True

            if recreate:
                logger.info(f"🆕 Tạo mới collection: {collection_name} (Size: {vector_size})")
                self.qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
                )
            
            await QdrantVectorStore.afrom_documents(
                vector_docs, self.embeddings, url=settings.QDRANT_URL, collection_name=collection_name
            )
            
        logger.info(f"✅ Đã nạp xong cấu trúc Schema cho {datasource_name}")

    async def query(self, user_query: str) -> str:
        """
        Truy vấn kết hợp Graph (Neo4J) + Vector (Qdrant).
        """
        logger.info(f"🔍 Bắt đầu truy vấn Hybrid GraphRAG cho: {user_query} (Type={self.collection_type})")
        
        try:
            # Tên collection dựa trên model (Chuẩn hóa khớp với Ingestion)
            emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "default"))
            model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
            if "embedding_001" in model_slug and "gemini_" not in model_slug:
                model_slug = f"gemini_{model_slug}"
                
            import re
            if self.collection_type == "semantic":
                friendly_name = "schema"
            else:
                friendly_name = re.sub(r'[^a-z0-9]', '_', self.agent_name.lower())[:20]
            
            short_id = str(self.agent_id).split("-")[0] if self.agent_id else "global"
            collection_name = f"{self.collection_type}_{friendly_name}_{short_id}_{model_slug}"
            
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
            entities = []
            try:
                entities_res = await self.llm.ainvoke(entities_query)
                raw_entities_content = entities_res.content
                if isinstance(raw_entities_content, list):
                    clean_entities_content = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in raw_entities_content])
                else:
                    clean_entities_content = str(raw_entities_content)
                
                # Xử lý chuỗi trả về để lấy list sạch
                raw_content = clean_entities_content.replace("'", "").replace('"', '')
                entities = [e.strip().lower() for e in raw_content.split(",") if len(e.strip()) > 1]
            except Exception as e:
                logger.warning(f"⚠️ Lỗi trích xuất thực thể (Entities Extraction): {e}. Sẽ dùng vector search thuần túy.")
            
            if entities:
                # 2.2 Đổi Cypher: Dùng toLower() và ANY() để khớp từ khóa linh hoạt hơn
                # CÔ LẬP: Chỉ lấy các node thuộc về Agent hiện tại
                prefix = f"agent_{self.agent_id}:"
                cypher = """
                MATCH (n)-[r]->(m)
                WHERE n.id STARTS WITH $prefix AND m.id STARTS WITH $prefix
                  AND ANY(e IN $entities WHERE toLower(n.id) CONTAINS e OR toLower(m.id) CONTAINS e)
                RETURN n.id + ' -- ' + type(r) + ' --> ' + m.id as relationship
                LIMIT 15
                """
                try:
                    graph_data = self.graph.query(cypher, params={"entities": entities, "prefix": prefix})
                    # Xóa prefix khi hiển thị context cho LLM để không làm nó bối rối
                    graph_context = "\n".join([row['relationship'].replace(prefix, "") for row in graph_data])
                except Exception as e:
                    logger.warning(f"⚠️ Lỗi truy vấn Cypher: {str(e)}")
            
            # 3. Kết hợp và trả về kết quả cuối cùng
            if not vector_context.strip() and not graph_context.strip():
                full_context = "Không tìm thấy dữ liệu liên quan trong kho tri thức."
            else:
                full_context = f"DỮ LIỆU VECTOR:\n{vector_context}\n\nDỮ LIỆU ĐỒ THỊ (RELATIONSHIPS):\n{graph_context}"
            
            final_prompt = (
                "Bạn là một trợ lý phân tích dữ liệu chuyên nghiệp. Dựa trên các thông tin từ hệ thống GraphRAG dưới đây, hãy trả lời câu hỏi.\n"
                "Nếu không có thông tin liên quan, hãy trả lời dựa trên kiến thức chung nhưng có lưu ý cho người dùng.\n\n"
                f"NGỮ CẢNH:\n{full_context}\n\n"
                f"CÂU HỎI: {user_query}"
            )
            
            try:
                # Sử dụng timeout ngắn hơn cho tác vụ nội bộ nếu cần, hoặc đảm bảo gọi ổn định
                response = await self.llm.ainvoke(final_prompt)
                raw_final_content = response.content
                if isinstance(raw_final_content, list):
                    return "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in raw_final_content])
                return str(raw_final_content)
            except Exception as e:
                logger.error(f"❌ Lỗi khi gọi LLM cho kết quả Hybrid RAG: {e}")
                # Trả về context thô nếu LLM sập để Text2SQL vẫn có cơ hội hoạt động
                return f"Dữ liệu thô từ hệ thống tra cứu: {full_context}"
            
        except Exception as e:
            logger.error(f"❌ Lỗi trong quá trình Hybrid Query: {str(e)}")
            return f"Lỗi truy vấn tri thức: {str(e)}"

    async def delete_agent_graph(self):
        """
        Xóa sạch dữ liệu Đồ thị và Vector của Agent này.
        """
        prefix = f"agent_{self.agent_id}:"
        logger.info(f"🗑️ Đang xóa dữ liệu GraphRAG cho Agent: {self.agent_id}")
        
        # 1. Xóa trong Neo4J
        cypher = "MATCH (n) WHERE n.id STARTS WITH $prefix DETACH DELETE n"
        try:
            self.graph.query(cypher, params={"prefix": prefix})
            logger.info(f"✅ Đã xóa các node trong Neo4J với prefix: {prefix}")
        except Exception as e:
            logger.error(f"❌ Lỗi khi xóa Neo4J: {e}")
            
        # 2. Xóa trong Qdrant (Xóa tất cả các collection liên quan)
        try:
            collections = self.qdrant_client.get_collections().collections
            for col in collections:
                if str(self.agent_id).split("-")[0] in col.name:
                    self.qdrant_client.delete_collection(col.name)
                    logger.info(f"✅ Đã xóa Qdrant collection: {col.name}")
        except Exception as e:
            logger.error(f"❌ Lỗi khi xóa Qdrant: {e}")
            
        logger.info(f"✨ Đã dọn dẹp xong dữ liệu cho Agent {self.agent_id}")

    async def delete_document(self, source_id: str):
        """
        Xóa dữ liệu liên quan đến một tài liệu cụ thể.
        """
        prefix = f"agent_{self.agent_id}:"
        full_source_id = f"{prefix}{source_id}" if not str(source_id).startswith("agent_") else source_id
        
        logger.info(f"🗑️ Đang xóa tài liệu: {full_source_id} (Agent: {self.agent_id})")
        
        # 1. Neo4J: Xóa node Document và các thực thể CHỈ thuộc về tài liệu này
        cypher_delete = """
        MATCH (d:Document {id: $source_id})
        DETACH DELETE d
        """
        # Sau khi xóa Document, xóa các node không còn bất kỳ quan hệ nào (orphans)
        cypher_cleanup = """
        MATCH (n)
        WHERE n.agent_id = $agent_id AND NOT (n)-[]-() 
        DELETE n
        """
        try:
            self.graph.query(cypher_delete, params={"source_id": full_source_id})
            self.graph.query(cypher_cleanup, params={"agent_id": str(self.agent_id)})
            logger.info(f"✅ Đã dọn dẹp xong Neo4J cho tài liệu: {full_source_id}")
        except Exception as e:
            logger.error(f"❌ Lỗi khi dọn dẹp Neo4J Document: {e}")

        # 2. Qdrant: Xóa vector theo source_id
        emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "text-embedding-004"))
        model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
        if self.collection_type == "semantic":
            friendly_name = "schema"
        else:
            friendly_name = re.sub(r'[^a-z0-9]', '_', self.agent_name.lower())[:20]
            
        short_id = str(self.agent_id).split("-")[0] if self.agent_id else "global"
        collection_name = f"{self.collection_type}_{friendly_name}_{short_id}_{model_slug}"
        
        try:
            if self.qdrant_client.collection_exists(collection_name):
                from qdrant_client.http import models as qmodels
                self.qdrant_client.delete(
                    collection_name=collection_name,
                    points_selector=qmodels.FilterSelector(
                        filter=qmodels.Filter(
                            must=[qmodels.FieldCondition(key="metadata.source", match=qmodels.MatchValue(value=full_source_id))]
                        )
                    )
                )
                logger.info(f"✅ Đã xóa vector của tài liệu {full_source_id} trong Qdrant.")
        except Exception as e:
            logger.error(f"❌ Lỗi khi xóa Qdrant vectors: {e}")

    async def delete_datasource(self, datasource_id: str):
        """
        Xóa dữ liệu liên quan đến một Connector cụ thể.
        """
        logger.info(f"🗑️ Đang xóa dữ liệu Connector: {datasource_id}")
        
        # 1. Neo4J: Xóa tất cả node Table/Column có datasource_id này
        cypher = "MATCH (n) WHERE n.datasource_id = $ds_id DETACH DELETE n"
        try:
            self.graph.query(cypher, params={"ds_id": str(datasource_id)})
            logger.info(f"✅ Đã xóa dữ liệu Connector trong Neo4J.")
        except Exception as e:
            logger.error(f"❌ Lỗi khi xóa Neo4J Connector: {e}")

        # 2. Qdrant: Xóa vector của schema này
        emb_model = getattr(self.embeddings, "model", getattr(self.embeddings, "model_name", "text-embedding-004"))
        model_slug = emb_model.replace("models/", "").replace("/", "_").replace("-", "_")
        short_id = str(self.agent_id).split("-")[0] if self.agent_id else "global"
        collection_name = f"semantic_schema_{short_id}_{model_slug}"
        
        try:
            if self.qdrant_client.collection_exists(collection_name):
                from qdrant_client.http import models as qmodels
                self.qdrant_client.delete(
                    collection_name=collection_name,
                    points_selector=qmodels.FilterSelector(
                        filter=qmodels.Filter(
                            must=[qmodels.FieldCondition(key="metadata.datasource_id", match=qmodels.MatchValue(value=str(datasource_id)))]
                        )
                    )
                )
                logger.info(f"✅ Đã xóa vector của Connector trong Qdrant.")
        except Exception as e:
            logger.error(f"❌ Lỗi khi xóa Qdrant schema vectors: {e}")
