import re
import logging
from typing import TypedDict, Any, Dict, List, Optional
from langgraph.graph import StateGraph, END

from app.agents.factory import get_model
from app.agents.tools.registry import get_tools_by_names
from app.agents.tools.graph_rag import GraphRAGSearchTool
from app.core.logging import get_logger

logger = get_logger(__name__, log_file="logs/workflow_executor.log")

from app.agents.workflows.utils import WorkflowState, resolve_variables

from app.agents.workflows.registry import NodeExecutorRegistry

def make_node_executor(node_id: str, node_type: str, node_data: dict, agent_config: dict):
    """
    Factory function that returns an async execution function for a specific node type
    using the modular NodeExecutorRegistry.
    """
    async def execute(state: WorkflowState):
        logger.info(f"🚀 [Workflow Executor] Node started: {node_id} ({node_type})")
        pool = state.get("variable_pool") or {}
        
        try:
            executor = NodeExecutorRegistry.create_executor(node_id, node_type, node_data, agent_config)
            outputs = await executor.execute(state)
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
            
        # Merge updated tool counts back to state if any node returned them
        if "tool_counts" in state:
            updates["tool_counts"] = state["tool_counts"]
            
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
                elif operator == "not_equals" and value != condition_val:
                    is_match = True
                elif operator == "contains" and condition_val in value:
                    is_match = True
                elif operator == "starts_with" and value.startswith(condition_val):
                    is_match = True
                elif operator == "is_empty" and not value:
                    is_match = True
                elif operator == "is_not_empty" and value:
                    is_match = True
                elif operator in ["greater_than", "less_than"]:
                    try:
                        # Try parsing as float for numeric comparison
                        v_num = float(value)
                        c_num = float(condition_val)
                        if operator == "greater_than" and v_num > c_num:
                            is_match = True
                        elif operator == "less_than" and v_num < c_num:
                            is_match = True
                    except ValueError:
                        # String fallback if not a number
                        if operator == "greater_than" and value > condition_val:
                            is_match = True
                        elif operator == "less_than" and value < condition_val:
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
