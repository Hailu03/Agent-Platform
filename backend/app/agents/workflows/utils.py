import re
from typing import TypedDict, List, Dict, Any, Optional

class WorkflowState(TypedDict):
    messages: List[Any]
    variable_pool: Dict[str, Any]  # Stores outputs of completed nodes: { "node_id": { "output_name": value } }
    current_node: str
    final_answer: str
    thread_id: Optional[str]
    tool_counts: Optional[Dict[str, int]]

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
