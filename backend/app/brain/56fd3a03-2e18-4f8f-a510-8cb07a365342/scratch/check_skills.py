
import asyncio
from sqlalchemy import select
from app.models.base import AsyncSessionLocal
from app.models.skill import Skill

async def check_skills():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Skill))
        skills = result.scalars().all()
        print(f"--- DANH SÁCH KỸ NĂNG ({len(skills)}) ---")
        for s in skills:
            print(f"ID: {s.id} | Name: '{s.name}' | Length: {len(s.name)}")
        print("-------------------------------")

if __name__ == "__main__":
    asyncio.run(check_skills())
