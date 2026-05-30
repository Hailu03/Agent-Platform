from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables
from app.agents.factory import get_model

class LLMNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        prompt_template = self.node_data.get("prompt", "")
        resolved_prompt = resolve_variables(prompt_template, pool)
        
        provider = self.agent_config.get("model_provider", "openai")
        model_name = self.agent_config.get("model_name", "gpt-4o")
        api_key = self.agent_config.get("api_key")
        
        llm = get_model(provider, model_name, api_key=api_key, streaming=True)
        response = await llm.ainvoke(resolved_prompt)
        
        return {"text": response.content}
