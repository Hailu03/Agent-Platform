from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables
from app.agents.tools.graph_rag import GraphRAGSearchTool

class KnowledgeNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        query_template = self.node_data.get("query", "")
        resolved_query = resolve_variables(query_template, pool)
        
        # Instantiate platform standard hybrid search tool
        rag_tool = GraphRAGSearchTool(agent_config=self.agent_config)
        result = await rag_tool._arun(resolved_query)
        
        return {"context": result}
