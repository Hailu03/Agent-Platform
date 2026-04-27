from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from app.core.config import settings

def clear_neo4j():
    print("🧹 Đang xóa dữ liệu Neo4j...")
    try:
        driver = GraphDatabase.driver(settings.NEO4J_URI, auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("MATCH (n) DETACH DELETE n")
        print("✅ Neo4j đã sạch bóng!")
        driver.close()
    except Exception as e:
        print(f"❌ Lỗi Neo4j: {e}")

def clear_qdrant():
    print("🧹 Đang xóa các collection trong Qdrant...")
    try:
        client = QdrantClient(url=settings.QDRANT_URL)
        collections = client.get_collections().collections
        for col in collections:
            client.delete_collection(col.name)
            print(f"   - Đã xóa collection: {col.name}")
        print("✅ Qdrant đã sạch bóng!")
    except Exception as e:
        print(f"❌ Lỗi Qdrant: {e}")

if __name__ == "__main__":
    clear_neo4j()
    clear_qdrant()
