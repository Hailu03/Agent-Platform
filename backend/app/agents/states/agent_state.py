from typing import Annotated, Sequence, TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Trạng thái mở rộng cho Agent.
    """
    messages: Annotated[Sequence[BaseMessage], add_messages]
    agent_id: str
    instructions: str
    metadata: dict
    # Sẵn sàng cho Tool outputs, RAG context, v.v.
    context: dict 
