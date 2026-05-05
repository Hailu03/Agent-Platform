
import asyncio
from sqlalchemy import select
from app.models.base import AsyncSessionLocal
from app.models.skill import Skill

async def check_skill_content():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Skill).where(Skill.name == 'Truy vấn Dữ liệu (Text2SQL Pro)'))
        skill = result.scalar_one_or_none()
        if skill:
            print(f"--- SKILL: {skill.name} ---")
            print(skill.content)
            print("-------------------------------")

if __name__ == "__main__":
    asyncio.run(check_skill_content())
