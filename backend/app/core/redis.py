import redis
import redis.asyncio as async_redis
import json
import hashlib
from typing import Optional, Any, Dict
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

from qdrant_client import QdrantClient
from qdrant_client.http import models
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os
from app.agents.factory import get_embeddings

class SemanticCache:
    def __init__(self):
        # Redis để lưu nội dung thô
        self.redis = redis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Qdrant để tìm kiếm ngữ nghĩa
        self.qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"), timeout=60)
        self.threshold = 0.96 # Độ tương đồng > 96% thì coi là giống nhau

    def _get_collection_name(self, agent_db: Any) -> str:
        """Tạo tên collection thân thiện và độc nhất cho cache của Agent."""
        # Lấy slug từ tên agent (nếu có)
        agent_name = getattr(agent_db, "name", "agent").lower()
        import re
        agent_slug = re.sub(r'[^a-z0-9]', '_', agent_name)[:20]
        
        # Lấy model slug
        model = getattr(agent_db, "embedding_model", "default")
        model_slug = model.replace("models/", "").replace("/", "_").replace("-", "_")
        
        # Kết hợp Agent ID (rút gọn) để đảm bảo duy nhất
        short_id = str(agent_db.id).split("-")[0]
        
        return f"cache_{agent_slug}_{short_id}_{model_slug}"

    def _ensure_collection(self, collection_name: str, size: int) -> bool:
        try:
            if not self.qdrant.collection_exists(collection_name):
                logger.info(f"🆕 Tạo collection cache mới: {collection_name} với size {size}")
                self.qdrant.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(size=size, distance=models.Distance.COSINE),
                )
            else:
                # Kiểm tra dimension
                coll = self.qdrant.get_collection(collection_name)
                existing_size = coll.config.params.vectors.size
                if existing_size != size:
                    logger.warning(f"⚠️ Dimension mismatch in cache {collection_name}: {existing_size} != {size}. Recreating...")
                    self.qdrant.delete_collection(collection_name)
                    self.qdrant.create_collection(
                        collection_name=collection_name,
                        vectors_config=models.VectorParams(size=size, distance=models.Distance.COSINE),
                    )
            return True
        except Exception as e:
            logger.error(f"❌ Lỗi Ensure Collection Cache: {e}")
            return False

    def get_chat_cache(self, agent_id: str, user_id: str, message: str, agent_db: Any = None, thread_id: str = None) -> Optional[Dict[str, Any]]:
        try:
            # Khởi tạo Embeddings từ Factory dựa trên config của Agent
            if not agent_db:
                return None
            
            from app.core.security import decrypt_password
            emb_key = decrypt_password(agent_db.embedding_api_key) if agent_db.embedding_api_key else None
            
            embeddings = get_embeddings(
                provider=agent_db.embedding_provider,
                model=agent_db.embedding_model,
                api_key=emb_key
            )
            
            # 1. Chuyển câu hỏi hiện tại thành Vector
            query_vector = embeddings.embed_query(message)
            
            collection_name = self._get_collection_name(agent_db)
            
            # Đảm bảo collection đúng kích thước vector
            if not self._ensure_collection(collection_name, len(query_vector)):
                return None
            
            # 2. Tìm câu hỏi tương đương trong Qdrant (Lọc theo user_id và thread_id)
            must_filter = [models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))]
            if thread_id:
                must_filter.append(models.FieldCondition(key="thread_id", match=models.MatchValue(value=thread_id)))

            search_result = self.qdrant.query_points(
                collection_name=collection_name,
                query=query_vector,
                query_filter=models.Filter(must=must_filter),
                limit=1
            ).points
            
            if search_result and search_result[0].score >= self.threshold:
                cache_key = search_result[0].payload["cache_key"]
                logger.info(f"🧠 Semantic Cache Hit ({collection_name})! Score: {search_result[0].score:.4f}")
                
                # 3. Lấy nội dung từ Redis
                data = self.redis.get(cache_key)
                if data:
                    return json.loads(data)
        except Exception as e:
            logger.error(f"❌ Lỗi Semantic Cache Get: {e}")
        return None

    def set_chat_cache(self, agent_id: str, user_id: str, message: str, response: Dict[str, Any], agent_db: Any = None, thread_id: str = None):
        try:
            if not agent_db:
                return
                
            import uuid
            cache_key = f"chat_content:{uuid.uuid4()}"
            
            from app.core.security import decrypt_password
            emb_key = decrypt_password(agent_db.embedding_api_key) if agent_db.embedding_api_key else None

            # Khởi tạo Embeddings từ Factory dựa trên config của Agent
            embeddings = get_embeddings(
                provider=agent_db.embedding_provider,
                model=agent_db.embedding_model,
                api_key=emb_key
            )
            
            # 1. Lưu nội dung vào Redis
            self.redis.set(cache_key, json.dumps(response), ex=86400)
            
            # 2. Lưu Vector và Key vào Qdrant (Kèm theo user_id và thread_id)
            vector = embeddings.embed_query(message)
            
            collection_name = self._get_collection_name(agent_db)
            
            # Đảm bảo collection đúng kích thước vector
            if not self._ensure_collection(collection_name, len(vector)):
                return
            
            self.qdrant.upsert(
                collection_name=collection_name,
                points=[
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vector,
                        payload={
                            "agent_id": agent_id,
                            "user_id": user_id,
                            "thread_id": thread_id,
                            "question": message,
                            "cache_key": cache_key
                        }
                    )
                ]
            )
            logger.info(f"💾 Đã lưu Semantic Cache vào {collection_name} (Thread: {thread_id})")
        except Exception as e:
            logger.error(f"❌ Lỗi Semantic Cache Set: {e}")

    def clear_chat_cache(self, agent_db: Any, thread_id: str, user_id: str):
        """Xóa sạch cache của một thread trong Redis và Qdrant."""
        try:
            collection_name = self._get_collection_name(agent_db)
            
            # 1. Tìm tất cả các points thuộc thread_id
            search_result = self.qdrant.scroll(
                collection_name=collection_name,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(key="thread_id", match=models.MatchValue(value=thread_id)),
                        models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))
                    ]
                ),
                limit=100,
                with_payload=True,
                with_vectors=False
            )[0]
            
            if search_result:
                # 2. Xóa các key trong Redis
                cache_keys = [p.payload["cache_key"] for p in search_result if "cache_key" in p.payload]
                if cache_keys:
                    self.redis.delete(*cache_keys)
                    logger.info(f"🗑️ Đã xóa {len(cache_keys)} cache keys trong Redis.")
                
                # 3. Xóa các points trong Qdrant
                self.qdrant.delete(
                    collection_name=collection_name,
                    points_selector=models.Filter(
                        must=[
                            models.FieldCondition(key="thread_id", match=models.MatchValue(value=thread_id)),
                            models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))
                        ]
                    )
                )
                logger.info(f"🗑️ Đã xóa cache vectors trong Qdrant collection {collection_name} cho Thread {thread_id}")
        except Exception as e:
            logger.error(f"❌ Lỗi Clear Chat Cache: {e}")

redis_cache = SemanticCache()

# Global Async Redis Client for SSE/PubSub
async_redis_client = async_redis.from_url(settings.REDIS_URL, decode_responses=True)
