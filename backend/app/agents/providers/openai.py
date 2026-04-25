from app.agents.providers.base import BaseLLMProvider
from langchain_openai import ChatOpenAI
from app.core.config import settings
from typing import Any, AsyncIterator

class OpenAIProvider(BaseLLMProvider):
    def __init__(self, model_name: str, temperature: float = 0.7, api_key: str = None):
        self.client = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=api_key or settings.OPENAI_API_KEY
        )

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        return await self.client.ainvoke(messages, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.client.astream(messages, **kwargs):
            yield chunk.content
