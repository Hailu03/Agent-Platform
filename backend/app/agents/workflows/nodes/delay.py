import asyncio
import logging
from typing import Any, Dict
from app.agents.workflows.nodes.base import BaseNodeExecutor

logger = logging.getLogger(__name__)

class DelayNodeExecutor(BaseNodeExecutor):
    """
    Control flow node that pauses execution asynchronously for a specified duration.
    """
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        duration_seconds = float(self.node_data.get("duration", 5))  # Default to 5 seconds
        logger.info(f"⏳ [Delay Node {self.node_id}] Pausing workflow execution for {duration_seconds} second(s)...")
        
        await asyncio.sleep(duration_seconds)
        
        logger.info(f"✅ [Delay Node {self.node_id}] Resume execution.")
        return {
            "waited_seconds": duration_seconds,
            "status": "completed"
        }
