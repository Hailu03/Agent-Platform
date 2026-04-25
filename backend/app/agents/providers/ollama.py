from app.agents.providers.base import BaseLLMProvider
from langchain_community.chat_models import ChatOllama
from app.core.config import settings
from typing import Any, AsyncIterator

class OllamaProvider(BaseLLMProvider):
    def __init__(self, model_name: str, temperature: float = 0.7):
        self.client = ChatOllama(
            model=model_name,
            base_url=settings.OLLAMA_URL,
            temperature=temperature
        )

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        return await self.client.ainvoke(messages, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.client.astream(messages, **kwargs):
            yield chunk.content
