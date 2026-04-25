from langchain_core.messages import SystemMessage, ToolMessage
from app.agents.states.agent_state import AgentState

class StandardNodes:
    """
    Tập hợp các Nodes tiêu chuẩn.
    """
    
    @staticmethod
    async def call_model_node(state: AgentState, provider, instructions: str):
        """
        Sử dụng provider.ainvoke thay vì gọi trực tiếp LangChain
        """
        messages = state["messages"]
        
        if not any(isinstance(m, SystemMessage) for m in messages):
            messages = [SystemMessage(content=instructions)] + list(messages)
        
        response = await provider.ainvoke(messages)
        return {"messages": [response]}

    @staticmethod
    async def tool_execution_node(state: AgentState, tools_map: dict):
        last_message = state["messages"][-1]
        tool_outputs = []
        
        for tool_call in last_message.tool_calls:
            tool_name = tool_call["name"]
            if tool_name in tools_map:
                output = await tools_map[tool_name].ainvoke(tool_call["args"])
                tool_outputs.append(
                    ToolMessage(
                        tool_call_id=tool_call["id"],
                        content=str(output)
                    )
                )
        
        return {"messages": tool_outputs}
