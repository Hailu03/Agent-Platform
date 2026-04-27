from app.agents.providers.openai import OpenAIProvider
from app.agents.providers.ollama import OllamaProvider
from app.agents.providers.anthropic import AnthropicProvider
from app.agents.providers.google import GoogleProvider

def get_model(provider_name: str, model_name: str, temperature: float = 0.7, api_key: str = None, streaming: bool = True):
    """
    Factory function trả về đối tượng Provider tương ứng
    """
    if provider_name == "openai":
        return OpenAIProvider(model_name, temperature, api_key, streaming=streaming)
    elif provider_name == "ollama":
        return OllamaProvider(model_name, temperature, streaming=streaming)
    elif provider_name == "anthropic":
        return AnthropicProvider(model_name, temperature, api_key, streaming=streaming)
    elif provider_name == "google":
        return GoogleProvider(model_name, temperature, api_key, streaming=streaming)
    
def get_embeddings(provider: str, model: str, api_key: str = None):
    """
    Factory function trả về đối tượng Embeddings tương ứng
    """
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(model=model, openai_api_key=api_key)
    elif provider == "google":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        return GoogleGenerativeAIEmbeddings(model=model, google_api_key=api_key)
    elif provider == "ollama":
        from langchain_community.embeddings import OllamaEmbeddings
        from app.core.config import settings
        return OllamaEmbeddings(model=model, base_url=settings.OLLAMA_URL)
    
    # Mặc định dùng Google (vì bạn đang dùng nó nhiều)
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    return GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=api_key)
