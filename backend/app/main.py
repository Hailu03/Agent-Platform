from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.models.base import engine, Base
from .routers import auth, agent, chat
from app.core.logging import setup_logging

# Khởi tạo logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tạo bảng nếu chưa tồn tại
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="WAO AI API",
    description="Backend API for WAO AI Platform",
    version="1.0.0",
    lifespan=lifespan
)

# Auth Router
app.include_router(auth.router, prefix="/api/v1")
app.include_router(agent.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1/chat")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS.split(",") if settings.ALLOWED_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    return {
        "success": True,
        "data": {
            "status": "healthy",
            "environment": settings.APP_ENV
        }
    }
