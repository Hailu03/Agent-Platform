from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables

class ConditionNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        resolved_val = ""
        variable_to_evaluate = self.node_data.get("variable_to_evaluate", "")
        if variable_to_evaluate:
            resolved_val = resolve_variables(f"{{{{{variable_to_evaluate}}}}}", pool)
        
        return {"value": resolved_val}
