import asyncio
from neo4j import GraphDatabase
from qdrant_client import QdrantClient
from app.core.config import settings

def check_neo4j():
    print("\n--- 🕸️ KIỂM TRA NEO4J ---")
    try:
        driver = GraphDatabase.driver(
            settings.NEO4J_URI, 
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
        with driver.session() as session:
            # Đếm số lượng Node
            node_count = session.run("MATCH (n) RETURN count(n) as count").single()["count"]
            # Đếm số lượng Mối quan hệ
            rel_count = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()["count"]
            
            print(f"✅ Kết nối Neo4j thành công!")
            print(f"📊 Tổng số Node (Thực thể): {node_count}")
            print(f"🔗 Tổng số Relationship (Mối quan hệ): {rel_count}")
            
            if node_count > 0:
                print("📝 Một số thực thể vừa trích xuất:")
                result = session.run("MATCH (n) RETURN n.id as name, labels(n)[0] as type LIMIT 5")
                for record in result:
                    print(f"   - {record['name']} ({record['type']})")
        driver.close()
    except Exception as e:
        print(f"❌ Lỗi Neo4j: {str(e)}")

def check_qdrant():
    print("\n--- 📍 KIỂM TRA QDRANT ---")
    try:
        client = QdrantClient(url=settings.QDRANT_URL)
        collections = client.get_collections().collections
        print(f"✅ Kết nối Qdrant thành công!")
        print(f"📦 Các collection hiện có: {[c.name for c in collections]}")
        
        for col in collections:
            count = client.count(collection_name=col.name).count
            print(f"   🔹 Collection '{col.name}': {count} vectors")
    except Exception as e:
        print(f"❌ Lỗi Qdrant: {str(e)}")

if __name__ == "__main__":
    check_neo4j()
    check_qdrant()
