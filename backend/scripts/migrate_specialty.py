import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys
import os

# Add the backend directory to sys.path to import app.core.config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.config import settings

async def migrate():
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Đang kiểm tra và cập nhật cấu trúc bảng 'agents'...")
        try:
            # Thêm cột specialty nếu chưa tồn tại
            await conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS specialty VARCHAR"))
            print("Thành công: Đã thêm cột 'specialty' vào bảng 'agents'.")
        except Exception as e:
            print(f"Lỗi khi cập nhật bảng: {e}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
