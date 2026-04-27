import httpx
import pdfplumber
import io
from typing import Type
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from app.core.logging import get_logger

logger = get_logger(__name__)

class PDFReaderInput(BaseModel):
    url: str = Field(description="URL của file PDF cần đọc nội dung")

class PDFReaderTool(BaseTool):
    name: str = "pdf_reader"
    description: str = "Dùng để đọc nội dung của file tài liệu định dạng PDF từ một URL. Hữu ích khi kết quả tìm kiếm trả về các báo cáo, tài liệu nghiên cứu dưới dạng file .pdf"
    args_schema: Type[BaseModel] = PDFReaderInput

    def _run(self, url: str) -> str:
        import asyncio
        return asyncio.run(self._arun(url))

    async def _arun(self, url: str) -> str:
        logger.info(f"📄 Đang bóc tách dữ liệu từ file PDF: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                
                # Đọc PDF từ stream dữ liệu nhị phân
                with pdfplumber.open(io.BytesIO(response.content)) as pdf:
                    text = ""
                    # Đọc tối đa 10 trang đầu để tránh quá tải
                    for page in pdf.pages[:10]:
                        page_text = page.extract_text()
                        if page_text:
                            text += page_text + "\n"
                
                if not text.strip():
                    return "Tài liệu PDF này không có lớp văn bản (có thể là file ảnh scan). Không thể đọc được nội dung."

                # Làm sạch và giới hạn độ dài
                if len(text) > 15000:
                    text = text[:15000] + "\n... (Tài liệu quá dài, đã cắt bớt)"
                
                logger.info(f"✅ Đã đọc xong PDF. Độ dài: {len(text)} ký tự.")
                return text
                
        except Exception as e:
            logger.error(f"❌ Lỗi khi đọc file PDF {url}: {str(e)}")
            return f"Lỗi khi xử lý file PDF: {str(e)}"
