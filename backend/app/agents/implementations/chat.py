from langgraph.graph import StateGraph, END
from app.agents.base import BaseWAOAgent
from app.agents.states.agent_state import AgentState
from app.agents.nodes.standard_nodes import StandardNodes

class StandardChatAgent(BaseWAOAgent):
    """
    Triển khai cụ thể một Agent Chat tiêu chuẩn.
    Dễ dàng mở rộng thêm logic rẽ nhánh (router) hoặc tools.
    """
    
    def _create_workflow(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        
        # Thêm các Node
        workflow.add_node("agent", self._agent_node)
        
        # Thiết lập luồng chạy
        workflow.set_entry_point("agent")
        workflow.add_edge("agent", END)
        
        return workflow

    async def _agent_node(self, state: AgentState):
        """
        Sử dụng StandardNodes
        """
        return await StandardNodes.call_model_node(
            state, 
            self.llm, 
            self.system_prompt
        )

# Ví dụ mở rộng sau này: ToolChatAgent(StandardChatAgent) 
# sẽ override _create_workflow để thêm Tool node và Router logic.
