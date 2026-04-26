import httpx
import logging
from typing import Optional, Type
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from bs4 import BeautifulSoup
from app.core.logging import get_logger

logger = get_logger(__name__)

class WebReaderInput(BaseModel):
    url: str = Field(description="URL của trang web hoặc bài báo cần đọc nội dung chi tiết")

class WebReaderTool(BaseTool):
    name: str = "web_reader"
    description: str = "Dùng để đọc nội dung chi tiết của một trang web từ URL. Hữu ích khi bạn đã có link bài báo và muốn đọc toàn bộ nội dung bên trong thay vì chỉ xem đoạn tóm tắt."
    args_schema: Type[BaseModel] = WebReaderInput

    def _run(self, url: str) -> str:
        import asyncio
        return asyncio.run(self._arun(url))

    async def _arun(self, url: str) -> str:
        logger.info(f"📖 Đang đọc nội dung chuyên sâu từ: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                
                # Sử dụng trafilatura để bóc tách nội dung chuyên sâu
                import trafilatura
                downloaded = response.text
                result = trafilatura.extract(downloaded, include_comments=False, include_tables=True, no_fallback=False)
                
                if result:
                    text = result
                else:
                    # Fallback về BeautifulSoup nếu trafilatura không bóc được
                    soup = BeautifulSoup(downloaded, "html.parser")
                    for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
                        element.decompose()
                    text = soup.get_text(separator="\n")

                # Làm sạch văn bản
                lines = (line.strip() for line in text.splitlines())
                text = "\n".join(line for line in lines if line)
                
                # Giới hạn độ dài
                if len(text) > 12000:
                    text = text[:12000] + "\n... (Nội dung quá dài, đã được cắt bớt)"
                
                logger.info(f"✅ Đã đọc xong bằng trafilatura. Độ dài: {len(text)} ký tự.")
                return text
                
        except Exception as e:
            logger.error(f"❌ Lỗi khi đọc trang web {url}: {str(e)}")
            return f"Không thể bóc tách nội dung từ link này. Lỗi: {str(e)}"
