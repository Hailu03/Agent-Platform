from app.agents.providers.base import BaseLLMProvider
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import settings
from typing import Any, AsyncIterator

class GoogleProvider(BaseLLMProvider):
    def __init__(self, model_name: str, temperature: float = 0.7, api_key: str = None, streaming: bool = True):
        # Chuẩn hóa tên model (đảm bảo có tiền tố models/ nếu cần)
        normalized_model = model_name
        if not (model_name.startswith("models/") or model_name.startswith("tunedModels/")):
            normalized_model = f"models/{model_name}"
            
        self.client = ChatGoogleGenerativeAI(
            model=normalized_model,
            temperature=temperature,
            google_api_key=api_key,
            streaming=streaming
        )

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        try:
            return await self.client.ainvoke(messages, **kwargs)
        except Exception as e:
            from app.core.logging import get_logger
            logger = get_logger(__name__)
            
            error_str = str(e)
            # Nếu lỗi 500 hoặc lỗi liên quan đến Tool/Function calling, thử fallback không dùng tool
            if "500" in error_str or "Internal error" in error_str or "400" in error_str:
                logger.warning(f"⚠️ Phát hiện lỗi tiềm ẩn khi gọi model với tools. Đang thử fallback không dùng tools... Lỗi: {e}")
                
                # Làm sạch messages: Chuyển ToolMessages và AIMessages có tool_calls thành text thuần túy
                sanitized_messages = []
                from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
                
                for msg in messages:
                    if isinstance(msg, ToolMessage):
                        # Chuyển kết quả tool thành lời nhắn của Human (hoặc System) để LLM đọc được
                        sanitized_messages.append(HumanMessage(content=f"[Kết quả công cụ: {msg.content}]"))
                    elif isinstance(msg, AIMessage) and msg.tool_calls:
                        # Chuyển yêu cầu gọi tool thành text
                        sanitized_messages.append(AIMessage(content=f"[Tôi đang gọi công cụ...] {msg.content}"))
                    else:
                        sanitized_messages.append(msg)

                # Tạo một client sạch không có tools để fallback
                from langchain_google_genai import ChatGoogleGenerativeAI
                model_name = self.client.model if hasattr(self.client, 'model') else "gemini-1.5-flash"
                
                clean_client = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=getattr(self.client, 'temperature', 0.7),
                    google_api_key=getattr(self.client, 'google_api_key', None),
                    streaming=getattr(self.client, 'streaming', False)
                )
                return await clean_client.ainvoke(sanitized_messages, **kwargs)
            
            # Nếu là lỗi khác, ném ra tiếp
            raise e

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[str]:
        try:
            async for chunk in self.client.astream(messages, **kwargs):
                yield chunk.content
        except Exception as e:
            from app.core.logging import get_logger
            logger = get_logger(__name__)
            
            error_str = str(e)
            if "500" in error_str or "Internal error" in error_str or "400" in error_str:
                logger.warning(f"⚠️ Phát hiện lỗi tiềm ẩn khi astream với tools. Đang thử fallback không dùng tools...")
                
                # Làm sạch messages
                sanitized_messages = []
                from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
                for msg in messages:
                    if isinstance(msg, ToolMessage):
                        sanitized_messages.append(HumanMessage(content=f"[Kết quả công cụ: {msg.content}]"))
                    elif isinstance(msg, AIMessage) and msg.tool_calls:
                        sanitized_messages.append(AIMessage(content=f"[Tôi đang gọi công cụ...] {msg.content}"))
                    else:
                        sanitized_messages.append(msg)

                from langchain_google_genai import ChatGoogleGenerativeAI
                model_name = self.client.model if hasattr(self.client, 'model') else "gemini-1.5-flash"
                
                clean_client = ChatGoogleGenerativeAI(
                    model=model_name,
                    temperature=getattr(self.client, 'temperature', 0.7),
                    google_api_key=getattr(self.client, 'google_api_key', None),
                    streaming=True
                )
                async for chunk in clean_client.astream(sanitized_messages, **kwargs):
                    yield chunk.content
            else:
                raise e

    def bind_tools(self, tools: list) -> "GoogleProvider":
        from app.core.logging import get_logger
        logger = get_logger(__name__)
        
        if hasattr(self.client, "bind_tools"):
            model_name = getattr(self.client, "model", "unknown")
            logger.info(f"🔗 Đang thực hiện bind_tools cho model {model_name} với {len(tools)} công cụ.")
            
            # Nếu là model Gemma, có thể nó không hỗ trợ AFC (Automatic Function Calling) tốt
            # Chúng ta thử thêm tool_config để ổn định hóa
            tool_config = None
            if "gemma" in model_name.lower():
                logger.info(f"💡 Phát hiện model Gemma, tối ưu hóa cấu hình công cụ...")
                # Có thể thử mode="AUTO" hoặc để mặc định nhưng bọc trong try-except
            
            try:
                self.client = self.client.bind_tools(tools)
            except Exception as e:
                logger.error(f"❌ Lỗi khi bind_tools: {e}. Sẽ tiếp tục mà không có công cụ native.")
        else:
            logger.warning(f"⚠️ Model {getattr(self.client, 'model', 'unknown')} KHÔNG hỗ trợ bind_tools!")
        return self
