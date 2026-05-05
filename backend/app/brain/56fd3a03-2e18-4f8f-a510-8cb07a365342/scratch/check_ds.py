
import asyncio
from sqlalchemy import select
from app.models.base import AsyncSessionLocal
from app.models.datasource import DataSource

async def check_datasources():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DataSource))
        ds_list = result.scalars().all()
        print(f"--- DANH SÁCH DATASOURCE ({len(ds_list)}) ---")
        for ds in ds_list:
            print(f"ID: {ds.id} | Name: '{ds.name}' | Schema: '{ds.schema_name}' | Engine: {ds.engine}")
        print("-------------------------------")

if __name__ == "__main__":
    asyncio.run(check_datasources())
