import httpx
from typing import Optional, Type, List, Dict
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from app.core.logging import get_logger

# Sử dụng logger tập trung của hệ thống
logger = get_logger(__name__)

class SearchInput(BaseModel):
    query: str = Field(description="Từ khóa tìm kiếm (Ví dụ: 'Tin tức Trung Đông', 'Attention is all you need paper')")
    category: str = Field(
        default="general",
        description="Chọn 1 chủ đề: 'general' (Tổng hợp), 'news' (Tin tức), 'science' (Khoa học/Học thuật), 'it' (Công nghệ/Lập trình), 'files' (Tìm file PDF/DOCX)."
    )

class SearxngSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Useful for searching the internet to find current information, news, or specific facts. Use this when you need up-to-date information that is not in your training data."
    args_schema: Type[BaseModel] = SearchInput

    def _run(self, query: str) -> str:
        """Use the tool synchronously."""
        # Use httpx synchronously for LangChain compatibility if needed, 
        # but usually we want async.
        import asyncio
        return asyncio.run(self._arun(query))

    async def _arun(self, query: str, category: str = "general") -> str:
        """Use the tool asynchronously."""
        from app.core.config import settings
        searxng_url = settings.SEARXNG_URL
        
        logger.info(f"🔍 Đang tìm kiếm [{category.upper()}]: '{query}'")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                params = {
                    "q": query,
                    "format": "json",
                    "language": "vi-VN",
                    "categories": category
                }
                response = await client.get(f"{searxng_url}/search", params=params)
                response.raise_for_status()
                data = response.json()
                
                results = data.get("results", [])
                logger.info(f"✅ SearXNG trả về {len(results)} kết quả")
                
                if not results:
                    return "Không tìm thấy thông tin phù hợp trên internet."
                
                formatted_results = []
                for res in results[:5]:  # Lấy 5 kết quả đầu tiên để tránh quá tải context
                    formatted_results.append(f"Tiêu đề: {res.get('title')}\nLink: {res.get('url')}\nNội dung: {res.get('content')}\n---")
                
                return "\n".join(formatted_results)
        except Exception as e:
            logger.error(f"❌ Lỗi khi gọi SearXNG: {str(e)}")
            return f"Lỗi khi thực hiện tìm kiếm: {str(e)}"
