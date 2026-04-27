from langgraph.graph import StateGraph, END
from app.agents.base import BaseWAOAgent
from app.agents.states.agent_state import AgentState
from app.core.logging import get_logger

# Import các Nodes từ package nodes
from app.agents.nodes import (
    chat_agent_node, 
    chat_tools_node, 
    research_refiner_node, 
    summarizer_node, 
    chat_memorize_node
)

logger = get_logger(__name__)

class WAOChatAgent(BaseWAOAgent):
    """
    Agent hợp nhất: Hỗ trợ Chat, Tools, Deep Search và Memory.
    Sử dụng kiến trúc Modular Nodes.
    """
    
    def _create_workflow(self) -> StateGraph:
        from app.agents.states.agent_state import Context
        workflow = StateGraph(AgentState, context_schema=Context)
        
        # Đăng ký các Node (Sử dụng wrapper để truyền self)
        async def _agent_node(state, config):
            return await chat_agent_node(state, config, self)
            
        async def _tools_node(state):
            return await chat_tools_node(state, self)
            
        async def _research_refiner_node(state):
            return await research_refiner_node(state, self)
            
        async def _summarizer_node(state):
            return await summarizer_node(state, self)
            
        async def _memorize_node(state, config):
            return await chat_memorize_node(state, config, self)

        workflow.add_node("agent", _agent_node)
        workflow.add_node("tools", _tools_node)
        workflow.add_node("research_refiner", _research_refiner_node)
        workflow.add_node("summarizer", _summarizer_node)
        workflow.add_node("memorize", _memorize_node)
        
        # Thiết lập điểm bắt đầu
        workflow.set_entry_point("agent")
        
        # Rẽ nhánh
        workflow.add_conditional_edges(
            "agent",
            self._should_continue,
            {
                "continue": "tools",
                "end": "memorize"
            }
        )
        
        workflow.add_conditional_edges(
            "tools",
            self._after_tool_check,
            {
                "refine_search": "research_refiner",
                "go_back": "agent"
            }
        )
        
        workflow.add_edge("research_refiner", "summarizer")
        workflow.add_edge("summarizer", "agent")
        workflow.add_edge("memorize", END)
        
        return workflow

    def _should_continue(self, state: AgentState):
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "continue"
        return "end"

    def _after_tool_check(self, state: AgentState):
        messages = state["messages"]
        if len(messages) < 2: return "go_back"
        ai_message = messages[-2] 
        if hasattr(ai_message, "tool_calls") and ai_message.tool_calls:
            for tool_call in ai_message.tool_calls:
                if tool_call["name"] in ["web_search", "Tìm kiếm Internet", "Tìm kiếm Web"]:
                    return "refine_search"
        return "go_back"
