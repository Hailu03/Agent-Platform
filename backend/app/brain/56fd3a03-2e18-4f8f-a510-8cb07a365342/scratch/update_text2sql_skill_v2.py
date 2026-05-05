
import asyncio
from sqlalchemy import update
from app.models.base import AsyncSessionLocal
from app.models.skill import Skill

async def update_skill_content():
    new_content = """# TRUY VẤN DỮ LIỆU (TEXT2SQL PRO)

Sử dụng kỹ năng này khi bạn cần phân tích, báo cáo hoặc trích xuất thông tin từ các cơ sở dữ liệu đã kết nối. 

## QUY TRÌNH TRÌNH BÀY (BẮT BUỘC)

1. **Kết quả trước tiên**: Trình bày câu trả lời trực tiếp hoặc Bảng dữ liệu (Markdown Table) ngay ở đầu.
   - LƯU Ý: Bảng Markdown PHẢI có một dòng trống ở trên và ở dưới để render đúng.

2. **Nhận xét chuyên sâu**: Đưa ra nhận xét dựa trên dữ liệu.

3. **Ẩn chi tiết kỹ thuật**: Câu lệnh SQL PHẢI được ẩn trong khối rút gọn ở CUỐI CÙNG.
   - Cấu trúc chuẩn:
     <details>
     <summary>Xem câu lệnh SQL</summary>
     
     ```sql
     -- SQL của bạn ở đây
     ```
     
     </details>

## LƯU Ý QUAN TRỌNG
- Tuyệt đối không để thẻ HTML dính liền với nội dung Markdown (luôn cách ra bằng dòng trống).
- Giữ cho UI sạch sẽ, chỉ hiện SQL khi người dùng chủ động bấm xem.
"""
    async with AsyncSessionLocal() as db:
        await db.execute(update(Skill).where(Skill.name == 'Truy vấn Dữ liệu (Text2SQL Pro)').values(content=new_content))
        await db.commit()
        print("✅ Đã cập nhật Skill Text2SQL với hướng dẫn Markdown an toàn.")

if __name__ == "__main__":
    asyncio.run(update_skill_content())
