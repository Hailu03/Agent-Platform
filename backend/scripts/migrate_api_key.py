import asyncio
import sys
import os

# Thêm đường dẫn backend vào sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.models.base import engine

async def migrate():
    print("Starting migration: Add api_key to agents table...")
    async with engine.begin() as conn:
        try:
            # Kiểm tra xem cột đã tồn tại chưa
            result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='agents' AND column_name='api_key'"))
            column_exists = result.fetchone()
            
            if not column_exists:
                await conn.execute(text("ALTER TABLE agents ADD COLUMN api_key VARCHAR"))
                print("Successfully added api_key column.")
            else:
                print("Column api_key already exists.")
                
        except Exception as e:
            print(f"Error during migration: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
