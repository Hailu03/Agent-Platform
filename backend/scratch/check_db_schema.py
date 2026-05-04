import asyncio
from app.models.base import engine
from sqlalchemy import inspect

async def check():
    try:
        async with engine.connect() as conn:
            columns = await conn.run_sync(lambda sync_conn: inspect(sync_conn).get_columns('skills'))
            print("Columns in 'skills' table:")
            for c in columns:
                print(f"- {c['name']} ({c['type']})")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
