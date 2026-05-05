from typing import Optional, List, Type
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from sqlalchemy import select
from app.models.skill import Skill
from app.models.base import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)

class SkillLoaderInput(BaseModel):
    skill_name: str = Field(description="Tên của kỹ năng cần nạp (ví dụ: 'Nghiên cứu chuyên sâu', 'Phân tích dữ liệu')")

class SkillLoaderTool(BaseTool):
    name: str = "load_skill"
    description: str = (
        "CÔNG CỤ ƯU TIÊN SỐ 1. Luôn gọi công cụ này TRƯỚC KHI thực hiện bất kỳ hành động nào khác "
        "để nạp hướng dẫn chuyên sâu (Skill). Nếu câu hỏi liên quan đến phân tích dữ liệu, "
        "truy vấn SQL hoặc quy trình nghiệp vụ phức tạp, bạn PHẢI nạp Skill tương ứng trước."
    )
    args_schema: Type[BaseModel] = SkillLoaderInput
    
    def _run(self, skill_name: str) -> str:
        """Đồng bộ không được khuyến khích trong môi trường async này"""
        raise NotImplementedError("Use _arun instead")

    async def _arun(self, skill_name: str) -> str:
        skill_name = skill_name.strip()
        logger.info(f"📂 Đang nạp kỹ năng: {skill_name}")
        
        # Lấy DB session
        async for db in get_db():
            try:
                # Thử tìm kiếm chính xác trước
                result = await db.execute(
                    select(Skill).where(Skill.name == skill_name)
                )
                skill = result.scalar_one_or_none()
                
                # Nếu không thấy, thử tìm kiếm không phân biệt hoa thường (ilike)
                if not skill:
                    result = await db.execute(
                        select(Skill).where(Skill.name.ilike(f"%{skill_name}%"))
                    )
                    skill = result.scalar_one_or_none()
                
                if not skill:
                    # Debug encoding
                    hex_name = skill_name.encode('utf-8').hex()
                    logger.warning(f"❌ Không tìm thấy kỹ năng '{skill_name}' (Hex: {hex_name})")
                    return f"Lỗi: Không tìm thấy kỹ năng '{skill_name}'. Vui lòng kiểm tra lại danh sách kỹ năng khả dụng."
                
                logger.info(f"✅ Đã nạp kỹ năng: {skill.name}")
                return f"--- NỘI DUNG KỸ NĂNG: {skill.name} ---\n\n{skill.content}"
            except Exception as e:
                logger.error(f"Lỗi khi nạp kỹ năng {skill_name}: {e}")
                return f"Lỗi hệ thống khi nạp kỹ năng: {str(e)}"
