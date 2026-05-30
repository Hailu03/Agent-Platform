import json
import hashlib
from langchain_core.messages import ToolMessage
from langgraph.types import interrupt
from app.agents.states.agent_state import AgentState
from app.core.logging import get_logger
from app.core.redis import redis_cache

logger = get_logger(__name__)

from app.core.gateway import ToolExecutionGateway

async def chat_tools_node(state: AgentState, config: dict, agent_instance):
    """
    Node thực thi công cụ có hỗ trợ Caching + Thread Isolation qua Gateway.
    """
    last_message = state["messages"][-1]
    agent_id = state.get("agent_id", "default")
    tool_counts = state.get("tool_counts") or {}
    
    # Lấy thread_id từ config để phân loại session
    thread_id = config.get("configurable", {}).get("thread_id", "default")
    
    results = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        
        tool = agent_instance.tools_map.get(tool_name)
        if tool:
            observation_str, tool_counts = await ToolExecutionGateway.execute_tool(
                tool=tool,
                tool_args=tool_args,
                agent_id=agent_id,
                thread_id=thread_id,
                tool_counts=tool_counts,
                allow_hitl=True
            )
            results.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=observation_str
            ))
        else:
            results.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=f"Lỗi: Không tìm thấy công cụ {tool_name}."
            ))
            
    return {"messages": results, "tool_counts": tool_counts}
