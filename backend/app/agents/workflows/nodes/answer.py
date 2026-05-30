from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables

class AnswerNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        answer_template = self.node_data.get("answer", "")
        resolved_answer = resolve_variables(answer_template, pool)
        
        return {"answer": resolved_answer}
