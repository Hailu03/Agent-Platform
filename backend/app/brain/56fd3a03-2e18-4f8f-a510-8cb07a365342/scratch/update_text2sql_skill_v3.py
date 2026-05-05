
import asyncio
from sqlalchemy import update
from app.models.base import AsyncSessionLocal
from app.models.skill import Skill

async def update_skill_content():
    new_content = """# TRUY VẤN DỮ LIỆU (TEXT2SQL PRO)

Sử dụng kỹ năng này khi bạn cần phân tích, báo cáo hoặc trích xuất thông tin từ các cơ sở dữ liệu đã kết nối. 

## QUY TRÌNH TRÌNH BÀY (BẮT BUỘC)

1. **Hiển thị Bảng Dữ liệu**: Luôn đưa Bảng Markdown lên đầu tiên.
   - YÊU CẦU: Bảng phải nằm ngoài mọi thẻ HTML. Luôn có dòng trống ở trước và sau bảng.
   
2. **Nhận xét**: Phân tích ngắn gọn kết quả bên dưới bảng.

3. **Ẩn SQL**: Câu lệnh SQL đã dùng chỉ được xuất hiện ở CUỐI CÙNG, bên trong khối rút gọn:
   <details>
   <summary>Xem câu lệnh SQL</summary>
   
   ```sql
   -- Code SQL
   ```
   
   </details>

## LƯU Ý
- Tuyệt đối không lồng Bảng Markdown vào bên trong thẻ <details> hoặc <summary>.
- Không hiển thị SQL ở đầu câu trả lời.
"""
    async with AsyncSessionLocal() as db:
        await db.execute(update(Skill).where(Skill.name == 'Truy vấn Dữ liệu (Text2SQL Pro)').values(content=new_content))
        await db.commit()
        print("✅ Đã tối ưu hóa Skill Text2SQL: Chỉ hiển thị 1 khối SQL duy nhất ở cuối.")

if __name__ == "__main__":
    asyncio.run(update_skill_content())
