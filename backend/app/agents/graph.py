from app.agents.graphs.chat import WAOChatAgent

def create_chat_graph(agent_config: dict, checkpointer=None, store=None):
    """
    Factory function để tạo Graph phù hợp. 
    Sử dụng WAOChatAgent thống nhất cho cả trường hợp có hoặc không có công cụ.
    """
    if checkpointer:
        agent_config["checkpointer"] = checkpointer
    if store:
        agent_config["store"] = store
        
    agent = WAOChatAgent(agent_config)
    return agent.app
