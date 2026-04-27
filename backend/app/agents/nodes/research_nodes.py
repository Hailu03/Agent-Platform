import re
import asyncio
from langchain_core.messages import ToolMessage, HumanMessage
from app.agents.states.agent_state import AgentState
from app.core.logging import get_logger
from app.agents.factory import get_model

logger = get_logger(__name__)

async def research_refiner_node(state: AgentState, agent_instance):
    """
    Điều phối nghiên cứu sâu: Tự bóc tách URL và gọi reader ngầm.
    """
    search_result_content = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, ToolMessage):
            if "Link: " in msg.content:
                search_result_content = msg.content
                break
    
    if not search_result_content:
        return {"messages": []}

    urls = re.findall(r'Link:\s*(https?://[^\s]+)', search_result_content)[:2]
    if not urls:
        return {"messages": []}

    web_reader = agent_instance.tools_map.get("web_reader")
    pdf_reader = agent_instance.tools_map.get("pdf_reader")
    
    tasks = []
    for url in urls:
        if url.lower().endswith(".pdf") and pdf_reader:
            tasks.append(pdf_reader.ainvoke({"url": url}))
        elif web_reader:
            tasks.append(web_reader.ainvoke({"url": url}))

    if not tasks:
        return {"messages": []}

    logger.info(f"⚡ Đang thực thi song song {len(tasks)} tiến trình đọc nội dung chuyên sâu...")
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    combined_raw_content = ""
    for url, result in zip(urls, results):
        if isinstance(result, Exception):
            combined_raw_content += f"\n--- LỖI ĐỌC {url} ---\n{str(result)}\n"
        else:
            combined_raw_content += f"\n--- NỘI DUNG TỪ {url} ---\n{result}\n"
    
    return {"messages": [ToolMessage(
        tool_call_id="raw_research_data", 
        content=combined_raw_content
    )]}

async def summarizer_node(state: AgentState, agent_instance):
    """
    Tóm tắt dữ liệu thô.
    """
    raw_data = state["messages"][-1].content
    if not raw_data or "--- NỘI DUNG TỪ" not in raw_data:
        return {"messages": []}

    logger.info("🧠 Đang tóm tắt dữ liệu nghiên cứu...")
    
    try:
        summary_prompt = (
            "Hãy tóm tắt lại các ý chính quan trọng nhất từ dữ liệu internet thô dưới đây. "
            "Yêu cầu: Giữ nguyên các trích dẫn hoặc số liệu quan trọng, trình bày dạng bullet points.\n\n"
            f"DỮ LIỆU THÔ:\n{raw_data}"
        )
        
        summarizer_llm = get_model(agent_instance.provider, agent_instance.model_name, api_key=agent_instance.api_key)
        response = await summarizer_llm.ainvoke([HumanMessage(content=summary_prompt)])
        
        return {"messages": [ToolMessage(
            tool_call_id="research_summary", 
            content=f"\n\n--- BÁO CÁO TÓM TẮT NGHIÊN CỨU SÂU ---\n{response.content}\n"
        )]}
    except Exception as e:
        logger.error(f"⚠️ Lỗi tóm tắt: {str(e)}")
        return {"messages": [ToolMessage(tool_call_id="research_summary", content=f"Dữ liệu thô: {raw_data}")]}
