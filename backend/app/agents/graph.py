from app.agents.implementations.chat import StandardChatAgent

def create_chat_graph(agent_config: dict):
    """
    Factory function để tạo Graph phù hợp. 
    Sau này có thể thêm logic để chọn loại Agent (Chat, Tool, RAG, etc.)
    dựa vào agent_config.
    """
    # Hiện tại mặc định dùng StandardChatAgent
    # Sau này có thể rẽ nhánh: 
    # if agent_config.get("tools"): return ToolChatAgent(agent_config).app
    
    agent = StandardChatAgent(agent_config)
    return agent.app
