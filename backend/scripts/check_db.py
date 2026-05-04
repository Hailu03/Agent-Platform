import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
import sys

# Thêm đường dẫn app vào sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings

async def check():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"))
        cols = [r[0] for r in res.fetchall()]
        print(f"Columns in users table: {cols}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
