from datetime import datetime
from app.models.agent import Agent

ROUTER_ID = "router"

ROUTER_DEFAULT_INSTRUCTIONS = (
    "Bạn là WAO Assistant - Trợ lý AI cá nhân thông minh của hệ thống.\n"
    "Nhiệm vụ của bạn là hỗ trợ và trò chuyện thân thiện, xã giao với người dùng "
    "(như chào hỏi, hỏi thăm, giải thích chức năng). "
    "Bạn có khả năng điều phối và chuyển tiếp các câu hỏi chuyên môn của họ sang "
    "các Trợ lý con chuyên biệt khi cần thiết "
    "(như Trợ lý Chăm sóc Fanpage, Trợ lý Gmail, Phân tích dữ liệu SQL, v.v.).\n"
    "Hãy chào hỏi thân thiện, giới thiệu bản thân là WAO Assistant và khéo léo "
    "giới thiệu các Trợ lý con chuyên nghiệp mà hệ thống đang có để người dùng "
    "biết cách sử dụng."
)


def build_router_agent(user_id: str) -> Agent:
    """Build a blank router agent — model/api_key intentionally left unconfigured for user to set."""
    return Agent(
        id=ROUTER_ID,
        user_id=user_id,
        name="WAO Assistant",
        description="Trợ lý AI cá nhân thông minh của hệ thống. Tự động nhận diện ý định và định tuyến câu hỏi.",
        instructions=ROUTER_DEFAULT_INSTRUCTIONS,
        model_provider=None,
        model_name=None,
        api_key=None,
        embedding_provider="google",
        embedding_model="models/embedding-001",
        embedding_api_key=None,
        tools=[],
        skills=[],
        sub_agents=[],
        knowledge_files=[],
        triggers=[],
        mcp_servers=[],
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


async def get_or_create_router(agent_repo, user_id: str) -> Agent:
    """Fetch the router agent from DB, or create a blank one if it doesn't exist yet."""
    router = await agent_repo.get_by_id(ROUTER_ID, user_id)
    if not router:
        router = build_router_agent(user_id)
        router = await agent_repo.create(router)
    return router
