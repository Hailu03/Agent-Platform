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
    description: str = "Nạp nội dung chi tiết và hướng dẫn chuyên sâu cho một kỹ năng cụ thể. Sử dụng khi bạn cần thực hiện một nhiệm vụ chuyên môn mà bạn có trong danh sách kỹ năng."
    args_schema: Type[BaseModel] = SkillLoaderInput
    
    def _run(self, skill_name: str) -> str:
        """Đồng bộ không được khuyến khích trong môi trường async này"""
        raise NotImplementedError("Use _arun instead")

    async def _arun(self, skill_name: str) -> str:
        logger.info(f"📂 Đang nạp kỹ năng: {skill_name}")
        
        # Lấy DB session
        async for db in get_db():
            try:
                result = await db.execute(
                    select(Skill).where(Skill.name == skill_name)
                )
                skill = result.scalar_one_or_none()
                
                if not skill:
                    return f"Lỗi: Không tìm thấy kỹ năng '{skill_name}'. Vui lòng kiểm tra lại danh sách kỹ năng khả dụng."
                
                return f"--- NỘI DUNG KỸ NĂNG: {skill.name} ---\n\n{skill.content}"
            except Exception as e:
                logger.error(f"Lỗi khi nạp kỹ năng {skill_name}: {e}")
                return f"Lỗi hệ thống khi nạp kỹ năng: {str(e)}"
            finally:
                await db.close()
