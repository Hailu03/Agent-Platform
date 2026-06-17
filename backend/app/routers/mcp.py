from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from typing import List

from app.models.base import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.mcp import MCPServer
from app.schemas.mcp import MCPServerCreate, MCPServerUpdate, MCPServerResponse, MCPTestConnectionRequest
from app.services.integrations.mcp_service import MCPClientService

router = APIRouter(prefix="/mcp", tags=["MCP"])

@router.get("/", response_model=List[MCPServerResponse])
async def list_mcp_servers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Liệt kê toàn bộ các máy chủ MCP của người dùng hiện tại
    """
    result = await db.execute(
        select(MCPServer).where(MCPServer.user_id == current_user.id).order_by(MCPServer.created_at.desc())
    )
    return result.scalars().all()

@router.post("/", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED)
async def create_mcp_server(
    payload: MCPServerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tạo cấu hình máy chủ MCP mới
    """
    db_server = MCPServer(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        **payload.model_dump()
    )
    db.add(db_server)
    await db.commit()
    await db.refresh(db_server)
    return db_server

@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lấy thông tin chi tiết của một máy chủ MCP
    """
    result = await db.execute(
        select(MCPServer).where(MCPServer.id == server_id, MCPServer.user_id == current_user.id)
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Máy chủ MCP không tồn tại")
    return server

@router.patch("/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(
    server_id: str,
    payload: MCPServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cập nhật cấu hình máy chủ MCP
    """
    result = await db.execute(
        select(MCPServer).where(MCPServer.id == server_id, MCPServer.user_id == current_user.id)
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Máy chủ MCP không tồn tại")
        
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(server, key, value)
        
    await db.commit()
    await db.refresh(server)
    return server

@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mcp_server(
    server_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Xóa cấu hình máy chủ MCP
    """
    result = await db.execute(
        select(MCPServer).where(MCPServer.id == server_id, MCPServer.user_id == current_user.id)
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Máy chủ MCP không tồn tại")
        
    await db.delete(server)
    await db.commit()
    return None

@router.post("/test-connection")
async def test_mcp_connection(
    payload: MCPTestConnectionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Kiểm tra thử kết nối tới MCP Server trước khi lưu cấu hình
    """
    success = await MCPClientService.test_connection(
        url=payload.url,
        auth_type=payload.auth_type,
        auth_config=payload.auth_config
    )
    return {"connected": success}

@router.get("/{server_id}/tools")
async def list_mcp_server_tools(
    server_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Tải và phơi bày danh sách công cụ khả dụng của một MCP Server cụ thể
    """
    result = await db.execute(
        select(MCPServer).where(MCPServer.id == server_id, MCPServer.user_id == current_user.id)
    )
    server = result.scalars().first()
    if not server:
        raise HTTPException(status_code=404, detail="Máy chủ MCP không tồn tại")
        
    try:
        tools = await MCPClientService.fetch_tools_from_server(server)
        return {"tools": tools}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
