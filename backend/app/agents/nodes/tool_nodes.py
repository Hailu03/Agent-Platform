import json
import hashlib
from langchain_core.messages import ToolMessage
from app.agents.states.agent_state import AgentState
from app.core.logging import get_logger
from app.core.redis import redis_cache

logger = get_logger(__name__)

async def chat_tools_node(state: AgentState, agent_instance):
    """
    Node thực thi công cụ có hỗ trợ Caching.
    """
    last_message = state["messages"][-1]
    agent_id = state.get("agent_id", "default")
    
    results = []
    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        
        # 1. Tạo Cache Key
        args_str = json.dumps(tool_args, sort_keys=True)
        cache_hash = hashlib.md5(f"{tool_name}:{args_str}".encode()).hexdigest()
        cache_key = f"tool_cache:{agent_id}:{cache_hash}"
        
        # 2. Kiểm tra Cache
        cached_result = redis_cache.redis.get(cache_key)
        if cached_result:
            logger.info(f"⚡ [Tool Cache Hit] Trả về kết quả cũ cho {tool_name}")
            results.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=cached_result
            ))
            continue
            
        # 3. Thực thi Tool
        tool = agent_instance.tools_map.get(tool_name)
        if tool:
            logger.info(f"🛠️ [Tool Exec] Thực thi công cụ: {tool_name}")
            observation = await tool.ainvoke(tool_args)
            observation_str = str(observation)
            
            # 4. Lưu Cache (Chỉ lưu nếu không phải là thông báo lỗi)
            error_keywords = ["error", "lỗi", "unexpected", "failed", "exception", "not found"]
            is_error = any(kw in observation_str.lower() for kw in error_keywords)
            
            if not is_error:
                redis_cache.redis.set(cache_key, observation_str, ex=3600) # Lưu 1 tiếng
            else:
                logger.warning(f"⚠️ Không lưu cache cho {tool_name} vì kết quả chứa thông báo lỗi.")
            
            results.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=observation_str
            ))
    return {"messages": results}
