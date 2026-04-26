from app.agents.implementations.chat import StandardChatAgent
from app.agents.implementations.tool_chat import ToolChatAgent

def create_chat_graph(agent_config: dict):
    """
    Factory function để tạo Graph phù hợp. 
    Sau này có thể thêm logic để chọn loại Agent (Chat, Tool, RAG, etc.)
    dựa vào agent_config.
    """
    # Nếu agent có bật công cụ, sử dụng ToolChatAgent
    if agent_config.get("tools"):
        return ToolChatAgent(agent_config).app
    
    agent = StandardChatAgent(agent_config)
    return agent.app
