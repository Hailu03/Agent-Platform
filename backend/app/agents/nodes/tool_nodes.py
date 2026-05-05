import json
import hashlib
from langchain_core.messages import ToolMessage
from langgraph.types import interrupt
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
    tool_counts = state.get("tool_counts") or {}
    
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
                content=cached_result.decode() if isinstance(cached_result, bytes) else cached_result
            ))
            continue
            
        # 3. Kiểm tra Giới hạn (Rate Limit & Thread Limit)
        tool = agent_instance.tools_map.get(tool_name)
        if tool:
            # --- KIỂM TRA RATE LIMIT (Lần/phút) ---
            rate_limit = getattr(tool, "rate_limit", None)
            if rate_limit:
                rate_key = f"rate_limit:{agent_id}:{tool_name}"
                current_calls = redis_cache.redis.incr(rate_key)
                if current_calls == 1:
                    redis_cache.redis.expire(rate_key, 60) # Reset mỗi phút
                
                if current_calls > rate_limit:
                    logger.warning(f"🚫 [Rate Limit] {tool_name} đã đạt giới hạn {rate_limit} lần/phút.")
                    results.append(ToolMessage(
                        tool_call_id=tool_call["id"],
                        content=f"Lỗi: Công cụ {tool_name} đã đạt giới hạn gọi ({rate_limit} lần/phút). Vui lòng thử lại sau 1 phút."
                    ))
                    continue

            # --- KIỂM TRA THREAD LIMIT (Tổng số lần/phiên) ---
            thread_limit = getattr(tool, "thread_limit", None)
            if thread_limit:
                thread_id = "default"
                if hasattr(agent_instance, "config"):
                    thread_id = agent_instance.config.get("configurable", {}).get("thread_id", "default")
                
                thread_key = f"thread_limit:{thread_id}:{tool_name}"
                current_total = redis_cache.redis.incr(thread_key)
                if current_total == 1:
                    redis_cache.redis.expire(thread_key, 86400) # Lưu 24h
                
                if current_total > thread_limit:
                    logger.warning(f"🚫 [Thread Limit] {tool_name} đã đạt tổng giới hạn {thread_limit} lần.")
                    results.append(ToolMessage(
                        tool_call_id=tool_call["id"],
                        content=f"Lỗi: Công cụ {tool_name} đã đạt giới hạn tối đa ({thread_limit} lần) trong cuộc hội thoại này."
                    ))
                    continue

            # --- KIỂM TRA RUN LIMIT (Lần/lượt chạy) ---
            run_limit = getattr(tool, "run_limit", None)
            if run_limit:
                current_run_count = tool_counts.get(tool_name, 0) + 1
                tool_counts[tool_name] = current_run_count
                
                if current_run_count > run_limit:
                    logger.warning(f"🚫 [Run Limit] {tool_name} đã vượt giới hạn {run_limit} lần trong lượt chạy này.")
                    results.append(ToolMessage(
                        tool_call_id=tool_call["id"],
                        content=f"Lỗi: Công cụ {tool_name} đã vượt giới hạn ({run_limit} lần) trong câu trả lời này."
                    ))
                    continue
            else:
                # Vẫn đếm để track
                tool_counts[tool_name] = tool_counts.get(tool_name, 0) + 1

            # 4. Kiểm tra Human-in-the-loop (HITL)
            human_in_loop = getattr(tool, "human_in_loop", False)
            if human_in_loop:
                logger.info(f"🛑 [HITL] Đang chờ phê duyệt cho công cụ: {tool_name}")
                # LangGraph sẽ dừng tại đây và chờ Command(resume=...)
                decision = interrupt({
                    "action": "tool_approval",
                    "tool_name": tool_name,
                    "tool_args": tool_args,
                    "message": f"Duyệt thực thi công cụ '{getattr(tool, 'name', tool_name)}'?"
                })
                
                # Xử lý kết quả sau khi resume
                approved = False
                if isinstance(decision, bool):
                    approved = decision
                elif isinstance(decision, dict):
                    approved = decision.get("approved", False)
                
                if not approved:
                    logger.warning(f"❌ [HITL] Người dùng đã từ chối thực thi {tool_name}")
                    results.append(ToolMessage(
                        tool_call_id=tool_call["id"],
                        content=f"Người dùng đã từ chối thực thi công cụ {tool_name}."
                    ))
                    continue

            # 5. Thực thi Tool
            logger.info(f"🛠️ [Tool Exec] Thực thi công cụ: {tool_name}")
            observation = await tool.ainvoke(tool_args)
            observation_str = str(observation)
            
            # 4. Lưu Cache (Chỉ lưu nếu không phải là thông báo lỗi)
            # Kiểm tra xem có bắt đầu bằng các từ khóa lỗi không để tránh false positive (ví dụ: skill content có từ 'lỗi')
            error_prefixes = ["lỗi:", "error:", "unexpected error", "failed to", "exception:", "not found:"]
            is_error = any(observation_str.lower().startswith(prefix) for prefix in error_prefixes)
            
            if not is_error:
                redis_cache.redis.set(cache_key, observation_str, ex=3600) # Lưu 1 tiếng
            else:
                logger.warning(f"⚠️ Không lưu cache cho {tool_name} vì kết quả chứa thông báo lỗi.")
            
            results.append(ToolMessage(
                tool_call_id=tool_call["id"],
                content=observation_str
            ))
    return {"messages": results, "tool_counts": tool_counts}
