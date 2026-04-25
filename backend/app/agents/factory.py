from app.agents.providers.openai import OpenAIProvider
from app.agents.providers.ollama import OllamaProvider
from app.agents.providers.anthropic import AnthropicProvider
from app.agents.providers.google import GoogleProvider

def get_model(provider_name: str, model_name: str, temperature: float = 0.7, api_key: str = None):
    """
    Factory function trả về đối tượng Provider tương ứng
    """
    if provider_name == "openai":
        return OpenAIProvider(model_name, temperature, api_key)
    elif provider_name == "ollama":
        return OllamaProvider(model_name, temperature)
    elif provider_name == "anthropic":
        return AnthropicProvider(model_name, temperature, api_key)
    elif provider_name == "google":
        return GoogleProvider(model_name, temperature, api_key)
    
    # Mặc định dùng OpenAI
    return OpenAIProvider("gpt-4o", temperature, api_key)
