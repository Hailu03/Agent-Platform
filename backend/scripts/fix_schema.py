import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Thêm đường dẫn app vào sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings

async def run_sql(engine, sql):
    async with engine.begin() as conn:
        try:
            await conn.execute(text(sql))
            return True
        except Exception as e:
            print(f"Executing '{sql}' failed: {e}")
            return False

async def fix_schema():
    print(f"Connecting to: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    # Run each command independently
    await run_sql(engine, "ALTER TABLE skills ALTER COLUMN user_id DROP NOT NULL")
    await run_sql(engine, "ALTER TABLE skills ADD COLUMN required_tools JSONB")
    
    # Add Google OAuth columns to users table
    columns_to_add = [
        ("google_id", "VARCHAR"),
        ("google_access_token", "VARCHAR"),
        ("google_refresh_token", "VARCHAR"),
        ("google_token_expiry", "TIMESTAMP WITH TIME ZONE")
    ]
    
    for col_name, col_type in columns_to_add:
        await run_sql(engine, f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")

    await engine.dispose()
    print("Schema fix completed.")

if __name__ == "__main__":
    asyncio.run(fix_schema())
