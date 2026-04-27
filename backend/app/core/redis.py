import redis
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
        self.qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
        self.collection_name = "chat_semantic_cache"
        # Sẽ ensure_collection khi có vector đầu tiên
        self.threshold = 0.96 # Độ tương đồng > 96% thì coi là giống nhau

    def _ensure_collection(self, size: int = 768):
        try:
            coll = self.qdrant.get_collection(self.collection_name)
            existing_size = coll.config.params.vectors.size
            if existing_size != size:
                logger.warning(f"⚠️ Dimension mismatch: {existing_size} != {size}. Recreating collection...")
                self.qdrant.delete_collection(self.collection_name)
                raise Exception("Mismatch")
        except:
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=size, distance=models.Distance.COSINE),
            )

    def get_chat_cache(self, agent_id: str, user_id: str, message: str, agent_db: Any = None) -> Optional[Dict[str, Any]]:
        try:
            # Khởi tạo Embeddings từ Factory dựa trên config của Agent
            if not agent_db:
                return None
                
            embeddings = get_embeddings(
                provider=agent_db.embedding_provider,
                model=agent_db.embedding_model,
                api_key=agent_db.embedding_api_key
            )
            
            # 1. Chuyển câu hỏi hiện tại thành Vector
            query_vector = embeddings.embed_query(message)
            
            # Đảm bảo collection đúng kích thước vector
            self._ensure_collection(len(query_vector))
            
            # 2. Tìm câu hỏi tương đương trong Qdrant (Lọc theo agent_id VÀ user_id)
            search_result = self.qdrant.query_points(
                collection_name=self.collection_name,
                query=query_vector,
                query_filter=models.Filter(
                    must=[
                        models.FieldCondition(key="agent_id", match=models.MatchValue(value=agent_id)),
                        models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))
                    ]
                ),
                limit=1
            ).points
            
            if search_result and search_result[0].score >= self.threshold:
                cache_key = search_result[0].payload["cache_key"]
                logger.info(f"🧠 Semantic Cache Hit for User {user_id}! Score: {search_result[0].score:.4f}")
                
                # 3. Lấy nội dung từ Redis
                data = self.redis.get(cache_key)
                if data:
                    return json.loads(data)
        except Exception as e:
            logger.error(f"❌ Lỗi Semantic Cache Get: {e}")
        return None

    def set_chat_cache(self, agent_id: str, user_id: str, message: str, response: Dict[str, Any], agent_db: Any = None):
        try:
            if not agent_db:
                return
                
            import uuid
            cache_key = f"chat_content:{uuid.uuid4()}"
            
            # Khởi tạo Embeddings từ Factory dựa trên config của Agent
            embeddings = get_embeddings(
                provider=agent_db.embedding_provider,
                model=agent_db.embedding_model,
                api_key=agent_db.embedding_api_key
            )
            
            # 1. Lưu nội dung vào Redis
            self.redis.set(cache_key, json.dumps(response), ex=86400)
            
            # 2. Lưu Vector và Key vào Qdrant (Kèm theo user_id)
            vector = embeddings.embed_query(message)
            
            # Đảm bảo collection đúng kích thước vector
            self._ensure_collection(len(vector))
            
            self.qdrant.upsert(
                collection_name=self.collection_name,
                points=[
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vector,
                        payload={
                            "agent_id": agent_id,
                            "user_id": user_id,
                            "question": message,
                            "cache_key": cache_key
                        }
                    )
                ]
            )
            logger.info(f"💾 Đã lưu Semantic Cache cho User {user_id}")
        except Exception as e:
            logger.error(f"❌ Lỗi Semantic Cache Set: {e}")

redis_cache = SemanticCache()
