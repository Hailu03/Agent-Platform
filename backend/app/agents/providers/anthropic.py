from app.agents.providers.base import BaseLLMProvider
from langchain_anthropic import ChatAnthropic
from app.core.config import settings
from typing import Any, AsyncIterator

class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model_name: str, temperature: float = 0.7, api_key: str = None):
        self.client = ChatAnthropic(
            model=model_name,
            temperature=temperature,
            anthropic_api_key=api_key or settings.ANTHROPIC_API_KEY
        )

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        return await self.client.ainvoke(messages, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        async for chunk in self.client.astream(messages, **kwargs):
            yield chunk.content
