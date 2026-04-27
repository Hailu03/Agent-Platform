from app.agents.providers.base import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from typing import Any, AsyncIterator

class GoogleProvider(BaseLLMProvider):
    def __init__(self, model_name: str, temperature: float = 0.7, api_key: str = None, streaming: bool = True):
        self.client = ChatGoogleGenerativeAI(
            model=model_name,
            temperature=temperature,
            google_api_key=api_key,
            streaming=streaming
        )

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        return await self.client.ainvoke(messages, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.client.astream(messages, **kwargs):
            yield chunk.content

    def bind_tools(self, tools: list) -> "GoogleProvider":
        from app.core.logging import get_logger
        logger = get_logger(__name__)
        
        if hasattr(self.client, "bind_tools"):
            logger.info(f"🔗 Đang thực hiện bind_tools cho model {getattr(self.client, 'model', 'unknown')} với {len(tools)} công cụ.")
            self.client = self.client.bind_tools(tools)
        else:
            logger.warning(f"⚠️ Model {getattr(self.client, 'model', 'unknown')} KHÔNG hỗ trợ bind_tools!")
        return self
