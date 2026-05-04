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
        "\n\n[QUY TẮC LẬP LUẬN]:\n"
        "1. Nếu bạn cần sử dụng CÔNG CỤ, hãy thực hiện GỌI CÔNG CỤ ngay lập tức mà không cần giải thích thêm.\n"
        "2. Nếu bạn trả lời trực tiếp cho người dùng, bạn PHẢI trình bày các bước lập luận bên trong thẻ <thinking>...</thinking> trước khi đưa ra câu trả lời cuối cùng."
    )
    
    # Đối với các model Google (Gemini/Gemma), đôi khi thẻ thinking làm hỏng cấu trúc Function Call
    if agent_instance.provider == "google":
        thinking_instruction = (
            "\n\n[IMPORTANT]: If you decide to use a tool, ONLY output the tool call. "
            "Do NOT wrap it in any XML tags or add thinking text. "
            "Thinking is only required for direct text responses."
        )
    system_message = SystemMessage(content=agent_instance.system_prompt + memory_context + thinking_instruction)
    
    # 3. Gọi LLM
    response = await agent_instance.llm.ainvoke([system_message] + messages)
    return {"messages": [response]}
