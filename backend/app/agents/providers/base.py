from abc import ABC, abstractmethod
from typing import Any, Optional, AsyncIterator

class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""
    
    @abstractmethod
    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        """Invoke the LLM for a single response."""
        pass

    @abstractmethod
    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        """Stream the LLM response."""
        pass

    @abstractmethod
    def bind_tools(self, tools: list) -> "BaseLLMProvider":
        """Bind tools to the provider and return the provider instance."""
        pass
