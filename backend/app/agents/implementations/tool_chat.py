from langgraph.graph import StateGraph, END
from app.agents.base import BaseWAOAgent
from app.agents.states.agent_state import AgentState
from app.agents.nodes.standard_nodes import StandardNodes
from app.core.logging import get_logger

logger = get_logger(__name__)

class ToolChatAgent(BaseWAOAgent):
    """
    Agent hỗ trợ công cụ (Tools).
    Sử dụng LangGraph để rẽ nhánh giữa Agent và Tool Execution.
    """
    
    def _create_workflow(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        
        # Thêm các Node
        workflow.add_node("agent", self._agent_node)
        workflow.add_node("tools", self._tools_node)
        workflow.add_node("research_refiner", self._research_refiner_node) # Node "nối flow" thông minh
        
        # Thiết lập luồng chạy
        workflow.set_entry_point("agent")
        
        # Rẽ nhánh dựa trên kết quả của agent
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "tools",
                "end": END
            }
        )
        
        # SAU KHI CHẠY TOOL: Kiểm tra xem có phải vừa chạy Search không? 
        # Nếu phải, thì nhảy vào node Refiner để đọc sâu nội dung bài báo.
        workflow.add_conditional_edges(
            "tools",
            self._after_tool_check,
            {
                "refine_search": "research_refiner",
                "go_back": "agent"
            }
        )
        
        # Sau khi đọc sâu xong thì quay lại agent
        workflow.add_edge("research_refiner", "agent")
        
        return workflow

    def _should_continue(self, state: AgentState):
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        return "end"

    def _after_tool_check(self, state: AgentState):
        """
        NẾU vừa chạy tool 'web_search', hãy nối flow sang node đọc nội dung bài báo.
        """
        messages = state["messages"]
        if len(messages) < 2:
            return "go_back"
            
        ai_message = messages[-2] 
        
        logger.info(f"🔍 Kiểm tra rẽ nhánh: AI Message Type: {type(ai_message)}")
        
        # Kiểm tra xem AI có yêu cầu gọi 'web_search' không
        if hasattr(ai_message, "tool_calls") and ai_message.tool_calls:
            logger.info(f"📦 Tìm thấy {len(ai_message.tool_calls)} tool calls: {[t['name'] for t in ai_message.tool_calls]}")
            for tool_call in ai_message.tool_calls:
                if tool_call["name"] == "web_search":
                    logger.info("🎯 Đã phát hiện lệnh web_search! Đang bẻ lái sang node Đọc Sâu...")
                    return "refine_search"
        else:
            logger.warning("⚠️ Không tìm thấy tool_calls trong AI message trước đó.")
                    
        return "go_back"

    async def _research_refiner_node(self, state: AgentState):
        """
        Đây là node 'nối flow' tự động đọc sâu nội dung các kết quả tìm kiếm.
        """
        from langchain_core.messages import ToolMessage
        import re
        
        logger.info("🚀 Bắt đầu Node: research_refiner")
        
        # Tìm ToolMessage chứa kết quả của web_search
        search_result_content = ""
        for msg in reversed(state["messages"]):
            if isinstance(msg, ToolMessage):
                if "Link: " in msg.content:
                    search_result_content = msg.content
                    break
        
        if not search_result_content:
            logger.warning("❌ Không tìm thấy nội dung kết quả tìm kiếm để bóc tách URL.")
            return {"messages": []}

        # Tìm chính xác các URL được đánh dấu bởi chữ 'Link: '
        urls = re.findall(r'Link:\s*(https?://[^\s]+)', search_result_content)
        logger.info(f"🔗 Đã bóc tách được {len(urls)} URL từ kết quả tìm kiếm.")
        
        if not urls:
            return {"messages": []}

        # Lấy 1-2 URL đầu tiên để đọc sâu
        target_urls = urls[:2]
        refined_content = "\n\n--- HỆ THỐNG TỰ ĐỘNG ĐỌC SÂU NỘI DUNG TỪ CÁC LINK UY TÍN ---\n"
        
        web_reader = self.tools_map.get("web_reader")
        if web_reader:
            for url in target_urls:
                logger.info(f"🔄 LangGraph tự động nối flow: Đang đọc sâu {url}")
                result = await web_reader.ainvoke({"url": url})
                refined_content += f"\nNỘI DUNG TỪ {url}:\n{result}\n"
        
        return {"messages": [ToolMessage(
            tool_call_id="research_auto_refine", 
            content=refined_content
        )]}

    async def _agent_node(self, state: AgentState):
        return await StandardNodes.call_model_node(state, self.llm, self.system_prompt)

    async def _tools_node(self, state: AgentState):
        return await StandardNodes.tool_execution_node(state, self.tools_map)
