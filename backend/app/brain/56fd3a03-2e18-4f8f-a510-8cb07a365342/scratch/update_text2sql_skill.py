
import asyncio
from sqlalchemy import update
from app.models.base import AsyncSessionLocal
from app.models.skill import Skill

async def update_skill_content():
    new_content = """# TRUY VẤN DỮ LIỆU (TEXT2SQL PRO)

Sử dụng kỹ năng này khi bạn cần phân tích, báo cáo hoặc trích xuất thông tin từ các cơ sở dữ liệu đã kết nối. 

## QUY TRÌNH TRÌNH BÀY (BẮT BUỘC)

1. **Kết quả trước tiên**: Luôn đưa ra câu trả lời trực tiếp hoặc Bảng dữ liệu (Markdown Table) ngay ở đầu phản hồi.
2. **Nhận xét chuyên sâu**: Đưa ra 2-3 dòng nhận xét hoặc phân tích dựa trên dữ liệu vừa truy vấn được.
3. **Ẩn chi tiết kỹ thuật**: Câu lệnh SQL đã thực thi PHẢI được đặt ở cuối cùng và luôn nằm trong khối rút gọn Markdown (Sử dụng thẻ <details><summary>Xem câu lệnh SQL</summary>...</details>).
4. **Không spam SQL**: Tuyệt đối không in câu lệnh SQL ra ngay đầu câu trả lời.

## LƯU Ý KỸ THUẬT
- Sử dụng công cụ `query_database` để thực hiện truy vấn.
- Nếu kết quả trống, hãy thông báo nhẹ nhàng và kiểm tra xem câu hỏi có bị nhầm lẫn về logic không.
- Giữ cho bảng dữ liệu gọn gàng, sử dụng định dạng số (VD: 1,000,000) để dễ đọc.
"""
    async with AsyncSessionLocal() as db:
        await db.execute(update(Skill).where(Skill.name == 'Truy vấn Dữ liệu (Text2SQL Pro)').values(content=new_content))
        await db.commit()
        print("✅ Đã cập nhật hướng dẫn trình bày cho Skill Text2SQL.")

if __name__ == "__main__":
    asyncio.run(update_skill_content())
