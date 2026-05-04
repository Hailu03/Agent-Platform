import asyncio
import os
import sys
import uuid
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Thêm đường dẫn app vào sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings

# KỸ NĂNG GMAIL TỔNG HỢP (DUY NHẤT)
GMAIL_PRO_SKILL = {
    "name": "Trợ lý Gmail Chuyên nghiệp",
    "description": "Kỹ năng toàn diện để quản lý Gmail: đọc, tìm kiếm nâng cao, soạn thảo bản nháp, trả lời theo luồng và quản lý nhãn tự động.",
    "content": """# TRỢ LÝ GMAIL CHUYÊN NGHIỆP

Sử dụng kỹ năng này cho tất cả các tác vụ liên quan đến Gmail. Bạn có đầy đủ bộ công cụ để xử lý hộp thư một cách thông minh và an toàn.

## QUY TRÌNH LÀM VIỆC CHUẨN

1. **Tra cứu & Tìm kiếm**: 
   - Sử dụng `gmail_list` để xem nhanh 10 thư chưa đọc mới nhất.
   - Sử dụng `gmail_search` khi cần tìm thông tin cụ thể (ví dụ: `from:khachhang has:attachment`).
2. **Xử lý hội thoại**:
   - Sử dụng `gmail_read` để đọc nội dung chi tiết.
   - **Luôn ưu tiên** sử dụng `gmail_reply` khi phản hồi một email có sẵn để giữ lại lịch sử luồng (Thread).
3. **An toàn & Phê duyệt (Khuyến nghị)**:
   - Với các nội dung quan trọng, hãy sử dụng `gmail_draft` để soạn bản nháp và thông báo cho người dùng kiểm tra trước khi gửi.
4. **Tổ chức hộp thư**:
   - Sử dụng `gmail_modify` để gán nhãn (STARRED, IMPORTANT), lưu trữ (Archive) hoặc xóa (TRASH) sau khi xử lý xong.

## DANH SÁCH CÔNG CỤ
- `gmail_list`: Liệt kê thư chưa đọc.
- `gmail_read`: Đọc chi tiết thư.
- `gmail_search`: Tìm kiếm nâng cao.
- `gmail_send`: Gửi thư mới (HTML).
- `gmail_reply`: Trả lời theo luồng (Thread).
- `gmail_draft`: Tạo/Quản lý bản nháp.
- `gmail_modify`: Quản lý nhãn và trạng thái.
"""
}

async def seed():
    print(f"🔄 Đang dọn dẹp và cập nhật Skills tại: {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # 1. Xóa các bản cũ từng cái một để tránh lỗi syntax IN
        old_names = ["Trợ lý Gmail Thông minh", "Trợ lý Gmail Chuyên sâu (Pro)", "Trợ lý Gmail Chuyên nghiệp"]
        for name in old_names:
            await conn.execute(
                text("DELETE FROM skills WHERE name = :name AND is_template = TRUE"),
                {"name": name}
            )
        print("🧹 Đã dọn dẹp các bản cũ.")

        # 2. Thêm bản gộp duy nhất
        skill_id = str(uuid.uuid4())
        await conn.execute(
            text("INSERT INTO skills (id, name, description, content, is_template, user_id, required_tools) VALUES (:id, :name, :description, :content, TRUE, NULL, :required_tools)"),
            {
                "id": skill_id,
                "name": GMAIL_PRO_SKILL["name"],
                "description": GMAIL_PRO_SKILL["description"],
                "content": GMAIL_PRO_SKILL["content"],
                "required_tools": json.dumps(["Gmail"])
            }
        )
        print(f"✅ Đã thêm Kỹ năng gộp: {GMAIL_PRO_SKILL['name']}")

    await engine.dispose()
    print("✨ Quá trình gộp Skill hoàn tất.")

if __name__ == "__main__":
    asyncio.run(seed())
