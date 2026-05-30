from abc import ABC, abstractmethod
from typing import Any, Dict
from app.core.logging import get_logger

logger = get_logger(__name__)

class BaseNodeExecutor(ABC):
    def __init__(self, node_id: str, node_data: Dict[str, Any], agent_config: Dict[str, Any]):
        self.node_id = node_id
        self.node_data = node_data
        self.agent_config = agent_config

    @abstractmethod
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the node logic and returns a dictionary of output values.
        """
        pass
