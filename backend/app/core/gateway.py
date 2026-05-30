import json
import hashlib
from typing import Any, Dict, Optional, Tuple
from langgraph.types import interrupt
from app.core.logging import get_logger
from app.core.redis import redis_cache

logger = get_logger(__name__)

class ToolExecutionGateway:
    @staticmethod
    async def execute_tool(
        tool: Any,
        tool_args: Dict[str, Any],
        agent_id: str,
        thread_id: str,
        tool_counts: Dict[str, int],
        allow_hitl: bool = True
    ) -> Tuple[str, Dict[str, int]]:
        """
        Executes a tool with full policy checks (caching, rate limits, thread limits, run limits, HITL approval).
        Returns a tuple: (observation_string, updated_tool_counts).
        """
        tool_name = tool.name if hasattr(tool, "name") else str(tool)
        
        # 1. Caching check
        args_str = json.dumps(tool_args, sort_keys=True)
        cache_hash = hashlib.md5(f"{tool_name}:{args_str}".encode()).hexdigest()
        cache_key = f"tool_cache:{thread_id}:{agent_id}:{cache_hash}"
        
        try:
            cached_result = redis_cache.redis.get(cache_key)
            if cached_result:
                logger.info(f"⚡ [Tool Cache Hit] Trả về kết quả cũ cho {tool_name}")
                val = cached_result.decode() if isinstance(cached_result, bytes) else cached_result
                return val, tool_counts
        except Exception as e:
            logger.warning(f"⚠️ Redis cache check failed: {e}")

        # 2. Rate Limit (Times/minute)
        rate_limit = getattr(tool, "rate_limit", None)
        if rate_limit:
            rate_key = f"rate_limit:{agent_id}:{tool_name}"
            try:
                current_calls = redis_cache.redis.incr(rate_key)
                if current_calls == 1:
                    redis_cache.redis.expire(rate_key, 60)
                if current_calls > rate_limit:
                    logger.warning(f"🚫 [Rate Limit] {tool_name} đã đạt giới hạn {rate_limit} lần/phút.")
                    return f"Lỗi: Công cụ {tool_name} đã đạt giới hạn gọi ({rate_limit} lần/phút). Vui lòng thử lại sau 1 phút.", tool_counts
            except Exception as e:
                logger.warning(f"⚠️ Redis rate limit check failed: {e}")

        # 3. Thread Limit (Times/session)
        thread_limit = getattr(tool, "thread_limit", None)
        if thread_limit:
            thread_key = f"thread_limit:{thread_id}:{tool_name}"
            try:
                current_total = redis_cache.redis.incr(thread_key)
                if current_total == 1:
                    redis_cache.redis.expire(thread_key, 86400)
                if current_total > thread_limit:
                    logger.warning(f"🚫 [Thread Limit] {tool_name} đã đạt tổng giới hạn {thread_limit} lần.")
                    return f"Lỗi: Công cụ {tool_name} đã đạt giới hạn tối đa ({thread_limit} lần) trong cuộc hội thoại này.", tool_counts
            except Exception as e:
                logger.warning(f"⚠️ Redis thread limit check failed: {e}")

        # 4. Run Limit (Times/run)
        new_counts = dict(tool_counts)
        run_limit = getattr(tool, "run_limit", None)
        if run_limit:
            current_run_count = new_counts.get(tool_name, 0) + 1
            new_counts[tool_name] = current_run_count
            if current_run_count > run_limit:
                logger.warning(f"🚫 [Run Limit] {tool_name} đã vượt giới hạn {run_limit} lần trong lượt chạy này.")
                return f"Lỗi: Công cụ {tool_name} đã vượt giới hạn ({run_limit} lần) trong câu trả lời này.", new_counts
        else:
            new_counts[tool_name] = new_counts.get(tool_name, 0) + 1

        # 5. Human-in-the-loop (HITL) check
        human_in_loop = getattr(tool, "human_in_loop", False)
        if human_in_loop and allow_hitl:
            logger.info(f"🛑 [HITL] Đang chờ phê duyệt cho công cụ: {tool_name}")
            decision = interrupt({
                "action": "tool_approval",
                "tool_name": tool_name,
                "tool_args": tool_args,
                "message": f"Duyệt thực thi công cụ '{getattr(tool, 'name', tool_name)}'?"
            })
            
            approved = False
            if isinstance(decision, bool):
                approved = decision
            elif isinstance(decision, dict):
                approved = decision.get("approved", False)
            
            if not approved:
                logger.warning(f"❌ [HITL] Người dùng đã từ chối thực thi {tool_name}")
                return f"Người dùng đã từ chối thực thi công cụ {tool_name}.", new_counts

        # 6. Execute tool
        logger.info(f"🛠️ [Tool Exec] Thực thi công cụ: {tool_name}")
        observation = await tool.ainvoke(tool_args)
        observation_str = str(observation)

        # 7. Write to cache if no error
        error_prefixes = ["lỗi:", "error:", "unexpected error", "failed to", "exception:", "not found:"]
        is_error = any(observation_str.lower().startswith(prefix) for prefix in error_prefixes)
        
        if not is_error:
            try:
                redis_cache.redis.set(cache_key, observation_str, ex=3600)
            except Exception as e:
                logger.warning(f"⚠️ Redis set cache failed: {e}")
        else:
            logger.warning(f"⚠️ Không lưu cache cho {tool_name} vì kết quả chứa thông báo lỗi.")

        return observation_str, new_counts
