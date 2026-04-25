import json
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from app.repositories.agent_repo import AgentRepository
from app.agents.graph import create_chat_graph
from typing import AsyncGenerator
from app.core.logging import get_logger

logger = get_logger(__name__)

class ChatService:
    def __init__(self, agent_repo: AgentRepository):
        self.agent_repo = agent_repo

    async def process_chat(self, agent_id: str, user_id: str, message: str):
        # Giữ nguyên logic chat cũ (non-stream)
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent_config = self._get_agent_config(agent_db)
        graph = create_chat_graph(agent_config)
        
        input_state = self._prepare_input_state(agent_id, agent_db, message)
        
        final_state = await graph.ainvoke(input_state)
        ai_message = final_state["messages"][-1]
        
        return {"role": "assistant", "content": ai_message.content}

    async def stream_chat(self, agent_id: str, user_id: str, message: str) -> StreamingResponse:
        """
        API chính để chat với luồng dữ liệu đổ về liên tục (SSE)
        """
        agent_db = await self.agent_repo.get_by_id(agent_id, user_id)
        if not agent_db:
            raise HTTPException(status_code=404, detail="Agent not found")

        agent_config = self._get_agent_config(agent_db)
        graph = create_chat_graph(agent_config)
        input_state = self._prepare_input_state(agent_id, agent_db, message)
        logger.info(f"Bắt đầu stream chat cho Agent {agent_id} (Model: {agent_config['model_name']})")

        async def event_generator():
            try:
                # Sử dụng chế độ 'messages' của LangGraph để stream token nếu model hỗ trợ
                # Hoặc stream theo từng node tùy cấu hình
                async for event in graph.astream_events(input_state, version="v2"):
                    kind = event.get("event")
                    
                    # Debug log cho các sự kiện nội bộ
                    logger.debug(f"LangGraph Event: {kind}")

                    if kind == "on_chat_model_stream":
                        chunk = event["data"]["chunk"]
                        content = chunk.content
                        
                        # Xử lý Thinking (đặc biệt cho Gemini hoặc các model hỗ trợ CoT)
                        thinking = ""
                        # Một số provider lưu thinking trong additional_kwargs hoặc response_metadata
                        if hasattr(chunk, "additional_kwargs") and "thinking" in chunk.additional_kwargs:
                            thinking = chunk.additional_kwargs.get("thinking", "")
                        
                        # Nếu content là List, kiểm tra xem có block thinking không
                        if isinstance(content, list):
                            text_parts = []
                            for part in content:
                                if isinstance(part, dict):
                                    if part.get("type") == "thinking":
                                        thinking += part.get("thinking", "")
                                    else:
                                        text_parts.append(part.get("text", ""))
                                else:
                                    text_parts.append(str(part))
                            content = "".join(text_parts)

                        if thinking:
                            yield f"data: {json.dumps({'thinking': str(thinking)})}\n\n"
                        
                        if content:
                            yield f"data: {json.dumps({'content': str(content)})}\n\n"
                    
                    elif kind == "on_tool_start":
                        yield f"data: {json.dumps({'status': f'Đang sử dụng công cụ: {event['name']}'})}\n\n"
                
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    def _get_agent_config(self, agent_db):
        return {
            "name": agent_db.name,
            "specialty": agent_db.specialty,
            "description": agent_db.description,
            "model_provider": agent_db.model_provider,
            "model_name": agent_db.model_name,
            "api_key": agent_db.api_key,
            "instructions": agent_db.instructions,
            "tools": agent_db.tools,
        }

    def _prepare_input_state(self, agent_id, agent_db, message):
        return {
            "messages": [("user", message)],
            "agent_id": agent_id,
            "instructions": agent_db.instructions or "",
            "metadata": {}
        }
