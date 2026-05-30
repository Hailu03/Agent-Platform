from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor

class StartNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        last_msg = ""
        if state.get("messages"):
            msg = state["messages"][-1]
            if hasattr(msg, "content"):
                last_msg = msg.content
            elif isinstance(msg, tuple) and len(msg) >= 2:
                last_msg = msg[1]
            else:
                last_msg = str(msg)
        return {"user_query": last_msg}
