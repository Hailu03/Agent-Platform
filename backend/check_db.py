import asyncio
from app.models.base import engine
from app.models.agent import Agent
from sqlalchemy.future import select

async def check():
    async with engine.connect() as conn:
        result = await conn.execute(select(Agent))
        agents = result.scalars().all()
        print(f"Count: {len(agents)}")
        for a in agents:
            print(f"ID: {a.id}, Name: {a.name}, User: {a.user_id}")

if __name__ == "__main__":
    asyncio.run(check())
