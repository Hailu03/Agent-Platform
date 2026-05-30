import sys
import time
import math
import json
import datetime
import re
from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.utils import resolve_variables
from app.core.logging import get_logger

logger = get_logger(__name__)

# Sandbox configuration: allowed builtins and global modules
ALLOWED_BUILTINS = {
    "print": print, "len": len, "str": str, "int": int, "float": float,
    "list": list, "dict": dict, "set": set, "range": range,
    "abs": abs, "min": min, "max": max, "sum": sum, "round": round,
    "bool": bool, "enumerate": enumerate, "zip": zip,
    "map": map, "filter": filter, "sorted": sorted, "reversed": reversed
}

class CodeExecutionTimeout(Exception):
    pass

class CodeNodeExecutor(BaseNodeExecutor):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        pool = state.get("variable_pool") or {}
        code_text = self.node_data.get("code", "")
        inputs = {}
        for input_name, selector in self.node_data.get("inputs", {}).items():
            inputs[input_name] = resolve_variables(f"{{{{{selector}}}}}", pool)
        
        # Output container
        local_vars = {"inputs": inputs, "outputs": {}}
        
        # Build restricted globals
        safe_globals = {
            "__builtins__": ALLOWED_BUILTINS,
            "math": math,
            "json": json,
            "datetime": datetime,
            "re": re,
            "inputs": inputs,
            "outputs": local_vars["outputs"]
        }
        
        # Execution with thread-local sys.settrace to enforce timeout
        timeout_seconds = 3.0
        start_time = time.time()
        
        def tracer(frame, event, arg):
            if time.time() - start_time > timeout_seconds:
                raise CodeExecutionTimeout(f"Thời gian thực thi mã vượt quá giới hạn cho phép ({timeout_seconds} giây)")
            return tracer

        # Store previous trace function
        old_trace = sys.gettrace()
        try:
            sys.settrace(tracer)
            exec(code_text, safe_globals, local_vars)
        except CodeExecutionTimeout as te:
            logger.error(f"❌ Sandbox Code Execution Timeout in node {self.node_id}: {str(te)}")
            return {"error": str(te)}
        except Exception as e:
            logger.error(f"❌ Sandbox Code Execution Error in node {self.node_id}: {str(e)}")
            return {"error": f"Lỗi chạy Code: {str(e)}"}
        finally:
            sys.settrace(old_trace)
            
        return local_vars.get("outputs", {})
