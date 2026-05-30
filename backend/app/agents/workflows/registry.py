from typing import Dict, Type, Any
from app.agents.workflows.nodes.base import BaseNodeExecutor
from app.agents.workflows.nodes.start import StartNodeExecutor
from app.agents.workflows.nodes.llm import LLMNodeExecutor
from app.agents.workflows.nodes.code import CodeNodeExecutor
from app.agents.workflows.nodes.tool import ToolNodeExecutor
from app.agents.workflows.nodes.knowledge import KnowledgeNodeExecutor
from app.agents.workflows.nodes.answer import AnswerNodeExecutor
from app.agents.workflows.nodes.condition import ConditionNodeExecutor

class NodeExecutorRegistry:
    _registry: Dict[str, Type[BaseNodeExecutor]] = {
        "start": StartNodeExecutor,
        "llm": LLMNodeExecutor,
        "code": CodeNodeExecutor,
        "tool": ToolNodeExecutor,
        "knowledge": KnowledgeNodeExecutor,
        "answer": AnswerNodeExecutor,
        "condition": ConditionNodeExecutor,
    }

    @classmethod
    def get_executor_class(cls, node_type: str) -> Type[BaseNodeExecutor]:
        """
        Returns the executor class for the given node type.
        Raises ValueError if node type is not registered.
        """
        executor_cls = cls._registry.get(node_type.lower())
        if not executor_cls:
            raise ValueError(f"Unknown node type: {node_type}. No executor registered.")
        return executor_cls

    @classmethod
    def create_executor(
        cls,
        node_id: str,
        node_type: str,
        node_data: Dict[str, Any],
        agent_config: Dict[str, Any]
    ) -> BaseNodeExecutor:
        """
        Instantiates the node executor for the given node type.
        """
        executor_cls = cls.get_executor_class(node_type)
        return executor_cls(node_id, node_data, agent_config)

    @classmethod
    def register_executor(cls, node_type: str, executor_cls: Type[BaseNodeExecutor]):
        """
        Allows dynamic registration of custom node executors, ensuring high scalability.
        """
        cls._registry[node_type.lower()] = executor_cls
