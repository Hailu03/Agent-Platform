import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
import os
import sys

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.config import settings

async def check_skills():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id, name, is_template, user_id FROM skills"))
        skills = result.fetchall()
        print(f"Total skills: {len(skills)}")
        for s in skills:
            print(f"ID: {s[0]}, Name: {s[1]}, IsTemplate: {s[2]}, UserId: {s[3]}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_skills())
