import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Thêm đường dẫn app vào sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings

async def migrate():
    print(f"Migrating database: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Kiểm tra và thêm cột content
        try:
            await conn.execute(text("ALTER TABLE skills ADD COLUMN content TEXT NOT NULL DEFAULT ''"))
            print("Added column 'content' to table 'skills'")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column 'content' already exists.")
            else:
                print(f"Error adding 'content': {e}")

        # Kiểm tra và thêm cột is_template
        try:
            await conn.execute(text("ALTER TABLE skills ADD COLUMN is_template BOOLEAN DEFAULT FALSE"))
            print("Added column 'is_template' to table 'skills'")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column 'is_template' already exists.")
            else:
                print(f"Error adding 'is_template': {e}")

        # Xóa cột instruction nếu tồn tại
        try:
            await conn.execute(text("ALTER TABLE skills DROP COLUMN instruction"))
            print("Dropped column 'instruction' from table 'skills'")
        except Exception as e:
            print(f"Note: Column 'instruction' could not be dropped (might not exist or other error): {e}")

    await engine.dispose()
    print("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())
