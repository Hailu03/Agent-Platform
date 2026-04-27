import uuid
from app.agents.states.agent_state import AgentState
from langchain_core.runnables import RunnableConfig
from app.core.logging import get_logger
from app.agents.factory import get_model

logger = get_logger(__name__)

async def chat_memorize_node(state: AgentState, config: RunnableConfig, agent_instance):
    """
    Node âm thầm phân tích và ghi nhớ thông tin quan trọng.
    """
    context = config.get("context")
    store = config.get("store")
    user_id = context.user_id if context else "default"
    messages = state["messages"]
    
    if len(messages) >= 2 and store and user_id:
        last_user_msg = next((m.content for m in reversed(messages) if m.type == "human"), "")
        last_ai_msg = messages[-1].content
        
        if last_user_msg and last_ai_msg:
            prompt = (
                "Hãy trích xuất các thông tin quan trọng về người dùng (sở thích, dự án...) "
                "để ghi nhớ lâu dài. Nếu không có gì mới, trả về 'NONE'.\n\n"
                f"USER: {last_user_msg}\nAI: {last_ai_msg}"
            )
            
            light_model = get_model(agent_instance.provider, agent_instance.model_name, api_key=agent_instance.api_key)
            res = await light_model.ainvoke(prompt)
            
            facts = str(res.content).strip().split("\n")
            namespace = ("memories", user_id)
            
            for fact in facts:
                if fact.upper() != "NONE" and len(fact) > 5:
                    await store.aput(namespace, str(uuid.uuid4()), {"data": fact})
                    logger.info(f"🧠 Đã ghi nhớ: {fact[:50]}...")
    
    return state
