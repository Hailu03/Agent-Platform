import re
import logging
from typing import TypedDict, Any, Dict, List, Optional
from langgraph.graph import StateGraph, END

from app.agents.factory import get_model
from app.agents.tools.registry import get_tools_by_names
from app.agents.tools.graph_rag import GraphRAGSearchTool
from app.core.logging import get_logger

logger = get_logger(__name__, log_file="logs/workflow_executor.log")

class WorkflowState(TypedDict):
    messages: List[Any]
    variable_pool: Dict[str, Any]  # Stores outputs of completed nodes: { "node_id": { "output_name": value } }
    current_node: str
    final_answer: str

def resolve_variables(text_template: str, variable_pool: dict) -> str:
    """
    Resolves curly braces template placeholders like {{node_start.user_query}}
    using values stored in the variable_pool.
    """
    if not isinstance(text_template, str):
        return text_template
        
    def replace_match(match):
        path = match.group(1).strip()
        parts = path.split(".")
        if len(parts) >= 1:
            node_id = parts[0]
            val = variable_pool.get(node_id, {})
            # Traverse nested dictionary properties
            for part in parts[1:]:
                if isinstance(val, dict):
                    val = val.get(part, "")
                else:
                    return ""
            return str(val)
        return ""

    return re.sub(r"\{\{([^}]+)\}\}", replace_match, text_template)

def make_node_executor(node_id: str, node_type: str, node_data: dict, agent_config: dict):
    """
    Factory function that returns an async execution function for a specific node type.
    """
    async def execute(state: WorkflowState):
        logger.info(f"🚀 [Workflow Executor] Node started: {node_id} ({node_type})")
        pool = state.get("variable_pool") or {}
        
        outputs = {}
        
        try:
            # 1. START NODE
            if node_type == "start":
                # Extract the query from the last message in state
                last_msg = ""
                if state.get("messages"):
                    msg = state["messages"][-1]
                    if hasattr(msg, "content"):
                        last_msg = msg.content
                    elif isinstance(msg, tuple) and len(msg) >= 2:
                        last_msg = msg[1]
                    else:
                        last_msg = str(msg)
                outputs = {"user_query": last_msg}
                
            # 2. LLM NODE
            elif node_type == "llm":
                prompt_template = node_data.get("prompt", "")
                resolved_prompt = resolve_variables(prompt_template, pool)
                
                # Fetch agent model configurations
                provider = agent_config.get("model_provider", "openai")
                model_name = agent_config.get("model_name", "gpt-4o")
                api_key = agent_config.get("api_key")
                
                llm = get_model(provider, model_name, api_key=api_key, streaming=True)
                
                # Call LLM
                response = await llm.ainvoke(resolved_prompt)
                outputs = {"text": response.content}
                
            # 3. CODE NODE (Python execution)
            elif node_type == "code":
                code_text = node_data.get("code", "")
                inputs = {}
                for input_name, selector in node_data.get("inputs", {}).items():
                    inputs[input_name] = resolve_variables(f"{{{{{selector}}}}}", pool)
                
                # Execution environment dictionary
                local_vars = {"inputs": inputs, "outputs": {}}
                try:
                    # Execute python code
                    exec(code_text, {"__builtins__": __builtins__}, local_vars)
                    outputs = local_vars.get("outputs", {})
                except Exception as e:
                    logger.error(f"❌ Error executing python code in node {node_id}: {str(e)}")
                    outputs = {"error": f"Lỗi chạy Code: {str(e)}"}
                    
            # 4. SYSTEM TOOL NODE
            elif node_type == "tool":
                tool_name = node_data.get("tool_name")
                tool_params = {}
                for param_name, template_val in node_data.get("parameters", {}).items():
                    tool_params[param_name] = resolve_variables(template_val, pool)
                
                tools = get_tools_by_names([tool_name], agent_config)
                if tools:
                    tool = tools[0]
                    result = await tool.ainvoke(tool_params)
                    outputs = {"result": str(result)}
                else:
                    outputs = {"error": f"Không tìm thấy công cụ: {tool_name}"}
                    
            # 5. KNOWLEDGE / RETRIEVER NODE
            elif node_type == "knowledge":
                query_template = node_data.get("query", "")
                resolved_query = resolve_variables(query_template, pool)
                
                # Instantiate platform standard hybrid search tool
                rag_tool = GraphRAGSearchTool(agent_config=agent_config)
                result = await rag_tool._arun(resolved_query)
                outputs = {"context": result}
                
            # 6. ANSWER NODE
            elif node_type == "answer":
                answer_template = node_data.get("answer", "")
                resolved_answer = resolve_variables(answer_template, pool)
                outputs = {"answer": resolved_answer}
                
            # 7. CONDITION NODE
            elif node_type == "condition":
                # Evaluates output fields to determine routing
                # Let's save inputs into output for branch matching
                resolved_val = ""
                variable_to_evaluate = node_data.get("variable_to_evaluate", "")
                if variable_to_evaluate:
                    resolved_val = resolve_variables(f"{{{{{variable_to_evaluate}}}}}", pool)
                outputs = {"value": resolved_val}
                
        except Exception as e:
            logger.error(f"❌ Error running node {node_id}: {str(e)}")
            outputs = {"error": str(e)}
            
        # Update variable pool
        new_pool = dict(pool)
        new_pool[node_id] = outputs
        
        updates = {
            "variable_pool": new_pool,
            "current_node": node_id
        }
        
        if node_type == "answer":
            updates["final_answer"] = outputs.get("answer", "")
            
        logger.info(f"✅ [Workflow Executor] Node completed: {node_id} | Outputs: {outputs}")
        return updates
        
    return execute

def make_conditional_router(node_id: str, edges: List[dict], node_data: dict):
    """
    Factory function returning a routing logic for Condition Nodes.
    """
    def route(state: WorkflowState):
        pool = state.get("variable_pool") or {}
        node_output = pool.get(node_id, {})
        value = str(node_output.get("value", "")).strip().lower()
        
        # Look through edges originating from this condition node
        # React Flow handles look like: sourceHandle = 'branch_a'
        branches = node_data.get("branches", [])
        
        for edge in edges:
            if edge["source"] != node_id:
                continue
            handle_id = edge.get("sourceHandle")
            
            # Find the branch config corresponding to this handle
            matching_branch = None
            for b in branches:
                if b.get("handle_id") == handle_id or b.get("name") == handle_id:
                    matching_branch = b
                    break
            
            if matching_branch:
                # Evaluation expression
                condition_val = str(matching_branch.get("value", "")).strip().lower()
                operator = matching_branch.get("operator", "equals")
                
                is_match = False
                if operator == "equals" and value == condition_val:
                    is_match = True
                elif operator == "contains" and condition_val in value:
                    is_match = True
                elif operator == "starts_with" and value.startswith(condition_val):
                    is_match = True
                    
                if is_match:
                    logger.info(f"🔀 [Workflow Routing] Branch matched: {handle_id} -> target: {edge['target']}")
                    return edge["target"]
                    
        # Fallback to the first available edge that doesn't have a specific matching rule or the END node
        for edge in edges:
            if edge["source"] == node_id and edge.get("sourceHandle") == "default":
                return edge["target"]
                
        # If no default branch is specified, return the first outgoing target or END
        for edge in edges:
            if edge["source"] == node_id:
                return edge["target"]
                
        return END
        
    return route

class WorkflowExecutor:
    """
    Dynamically compiles low-code Node-to-Node graph specifications in JSON format
    into executable StateGraph objects managed by LangGraph.
    """
    def __init__(self, workflow_json: dict, agent_config: dict):
        self.nodes = workflow_json.get("nodes", [])
        self.edges = workflow_json.get("edges", [])
        self.agent_config = agent_config
        self.state_graph = StateGraph(WorkflowState)
        self._build_graph()
        
    def _build_graph(self):
        if not self.nodes:
            raise ValueError("Workflow JSON must contain at least one node.")
            
        start_node_id = None
        
        # 1. Register Nodes
        for node in self.nodes:
            node_id = node["id"]
            node_type = node.get("type", "custom")
            node_data = node.get("data", {})
            
            if node_type == "start":
                start_node_id = node_id
                
            executor = make_node_executor(node_id, node_type, node_data, self.agent_config)
            self.state_graph.add_node(node_id, executor)
            
        # Set Entry Point
        if start_node_id:
            self.state_graph.set_entry_point(start_node_id)
        else:
            self.state_graph.set_entry_point(self.nodes[0]["id"])
            
        # 2. Register Edges
        # Group edges by source node to detect branch routing
        edges_by_source = {}
        for edge in self.edges:
            src = edge["source"]
            if src not in edges_by_source:
                edges_by_source[src] = []
            edges_by_source[src].append(edge)
            
        for src_id, edges in edges_by_source.items():
            src_node = next((n for n in self.nodes if n["id"] == src_id), None)
            if not src_node:
                continue
                
            src_type = src_node.get("type")
            
            if src_type == "condition":
                # Condition nodes routing via conditional edges
                node_data = src_node.get("data", {})
                router = make_conditional_router(src_id, edges, node_data)
                
                path_map = {edge["target"]: edge["target"] for edge in edges}
                path_map["__end__"] = END
                
                self.state_graph.add_conditional_edges(src_id, router, path_map)
            else:
                # Direct transition
                target_id = edges[0]["target"]
                self.state_graph.add_edge(src_id, target_id)
                
        # 3. Handle END / ANSWER nodes
        for node in self.nodes:
            node_id = node["id"]
            node_type = node.get("type")
            # If the node has no outgoing edges, link it to END
            if node_id not in edges_by_source:
                self.state_graph.add_edge(node_id, END)
                
        # Compile graph
        self.app = self.state_graph.compile()
