from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables
from app.agents.tools.registry import get_tools_by_names
from app.core.gateway import ToolExecutionGateway

class ToolNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        tool_name = self.node_data.get("tool_name")
        tool_params = {}
        for param_name, template_val in self.node_data.get("parameters", {}).items():
            tool_params[param_name] = resolve_variables(template_val, pool)
        
        tools = get_tools_by_names([tool_name], self.agent_config)
        if not tools:
            return {"error": f"Không tìm thấy công cụ: {tool_name}"}
        
        tool = tools[0]
        agent_id = self.agent_config.get("id", "workflow_agent")
        thread_id = state.get("thread_id", "workflow_thread")
        tool_counts = state.get("tool_counts") or {}
        
        # Route execution through ToolExecutionGateway for caching and limits
        observation_str, updated_counts = await ToolExecutionGateway.execute_tool(
            tool=tool,
            tool_args=tool_params,
            agent_id=agent_id,
            thread_id=thread_id,
            tool_counts=tool_counts,
            allow_hitl=False  # Disable interactive HITL in background workflows
        )
        
        # Update tool counts in state (will be merged by runner)
        state["tool_counts"] = updated_counts
        
        return {"result": observation_str}
