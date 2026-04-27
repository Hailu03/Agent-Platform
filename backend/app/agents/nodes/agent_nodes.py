from langchain_core.messages import SystemMessage
from app.agents.states.agent_state import AgentState
from langchain_core.runnables import RunnableConfig
from app.core.logging import get_logger

logger = get_logger(__name__)

async def chat_agent_node(state: AgentState, config: RunnableConfig, agent_instance):
    """
    Node chính xử lý tư duy của Agent với bộ nhớ dài hạn.
    agent_instance: Instance của class Agent (chứa llm, system_prompt, v.v.)
    """
    messages = state["messages"]
    context = config.get("context")
    store = config.get("store")
    user_id = context.user_id if context else "default"
    
    # 1. Lục lại bộ nhớ dài hạn (Recall) từ LangGraph Store
    last_user_message = next((m.content for m in reversed(messages) if m.type == "human"), "")
    
    memory_context = ""
    if last_user_message and store and user_id:
        namespace = ("memories", user_id)
        memories = await store.asearch(
            namespace,
            query=last_user_message,
            limit=3,
        )
        if memories:
            memory_context = "\n\nNHỮNG GÌ BẠN ĐÃ BIẾT VỀ NGƯỜI DÙNG NÀY (BỘ NHỚ DÀI HẠN):\n" + "\n".join([f"- {d.value.get('data', '')}" for d in memories])
            logger.info(f"🧠 Đã nạp {len(memories)} mẩu ký ức vào context.")

    # 2. Xây dựng prompt
    thinking_instruction = (
        "\n\n[QUY TẮC BẮT BUỘC]: Trước khi trả lời, bạn PHẢI trình bày các bước lập luận, "
        "phân tích dữ liệu hoặc lập kế hoạch bên trong thẻ <thinking>...</thinking>. "
        "Sau đó mới đưa ra câu trả lời cuối cùng cho người dùng."
    )
    system_message = SystemMessage(content=agent_instance.system_prompt + memory_context + thinking_instruction)
    
    # 3. Gọi LLM
    response = await agent_instance.llm.ainvoke([system_message] + messages)
    return {"messages": [response]}
