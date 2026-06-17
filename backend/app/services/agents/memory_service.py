from qdrant_client import QdrantClient
from qdrant_client.http import models
from langchain_google_genai import GoogleGenerativeAIEmbeddings
import os
import uuid
from typing import List, Dict, Any
from app.core.logging import get_logger

logger = get_logger(__name__)

class LongTermMemoryService:
    def __init__(self):
        self.qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
        self.collection_name = "user_long_term_memory"
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        self._ensure_collection()

    def _ensure_collection(self):
        try:
            self.qdrant.get_collection(self.collection_name)
        except:
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=768, distance=models.Distance.COSINE),
            )

    async def save_memory(self, user_id: str, fact: str, metadata: Dict[str, Any] = None):
        """
        Lưu một sự thật/thông tin quan trọng về người dùng.
        """
        try:
            vector = self.embeddings.embed_query(fact)
            self.qdrant.upsert(
                collection_name=self.collection_name,
                points=[
                    models.PointStruct(
                        id=str(uuid.uuid4()),
                        vector=vector,
                        payload={
                            "user_id": user_id,
                            "fact": fact,
                            **(metadata or {})
                        }
                    )
                ]
            )
            logger.info(f"🧠 Đã ghi nhớ thông tin cho User {user_id}: {fact[:50]}...")
        except Exception as e:
            logger.error(f"❌ Lỗi lưu bộ nhớ dài hạn: {e}")

    async def search_memories(self, user_id: str, query: str, limit: int = 5) -> List[str]:
        """
        Tìm kiếm các thông tin liên quan đã nhớ về người dùng.
        """
        try:
            vector = self.embeddings.embed_query(query)
            results = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=vector,
                query_filter=models.Filter(
                    must=[models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))]
                ),
                limit=limit
            )
            return [res.payload["fact"] for res in results if res.score > 0.7]
        except Exception as e:
            logger.error(f"❌ Lỗi tìm kiếm bộ nhớ dài hạn: {e}")
            return []

memory_service = LongTermMemoryService()
