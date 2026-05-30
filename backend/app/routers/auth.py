from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings
from app.models.base import get_db
from app.models.facebook_connection import FacebookConnection
from app.models.google_tool_connection import GoogleToolConnection
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, GoogleLogin
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decrypt_password,
    encrypt_password,
    verify_password,
    get_password_hash,
    get_current_user,
)
from fastapi.responses import RedirectResponse
import urllib.parse
from app.core.logging import get_logger
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

GOOGLE_BASIC_SCOPES = "openid email profile"
GOOGLE_GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


async def exchange_facebook_code_for_short_lived_token(code: str) -> dict:
    import httpx

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/oauth/access_token",
            params={
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
                "code": code,
            },
        )
        if resp.status_code != 200:
            logger.error(f"Facebook short-lived token exchange failed: {resp.text}")
            raise HTTPException(status_code=400, detail="Không thể trao đổi Facebook authorization code.")
        return resp.json()


async def exchange_for_long_lived_user_token(short_lived_token: str) -> dict:
    import httpx

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "fb_exchange_token": short_lived_token,
            },
        )
        if resp.status_code != 200:
            logger.error(f"Facebook long-lived token exchange failed: {resp.text}")
            raise HTTPException(status_code=400, detail="Không thể đổi sang Facebook long-lived token.")
        return resp.json()


async def fetch_facebook_profile_and_pages(user_token: str) -> tuple[dict, list[dict]]:
    import httpx

    async with httpx.AsyncClient() as client:
        profile_resp = await client.get(
            f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/me",
            params={"fields": "id,name", "access_token": user_token},
        )
        if profile_resp.status_code != 200:
            logger.error(f"Facebook profile fetch failed: {profile_resp.text}")
            raise HTTPException(status_code=400, detail="Không thể lấy hồ sơ Facebook user.")

        pages_resp = await client.get(
            f"https://graph.facebook.com/{settings.META_GRAPH_VERSION}/me/accounts",
            params={"fields": "id,name,access_token,category,tasks", "access_token": user_token},
        )
        if pages_resp.status_code != 200:
            logger.error(f"Facebook pages fetch failed: {pages_resp.text}")
            raise HTTPException(status_code=400, detail="Không thể lấy danh sách Facebook Pages.")

        pages = []
        for page in pages_resp.json().get("data", []):
            pages.append(
                {
                    "id": page.get("id"),
                    "name": page.get("name"),
                    "category": page.get("category"),
                    "tasks": page.get("tasks", []),
                    "access_token": encrypt_password(page.get("access_token") or ""),
                }
            )
        return profile_resp.json(), pages


async def upsert_facebook_connection(
    db: AsyncSession,
    user_id: str,
    profile: dict,
    pages: list[dict],
    long_lived_token: str,
    expires_in: int,
    scopes: list[str],
) -> FacebookConnection:
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == user_id))
    connection = result.scalars().first()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in or 60 * 24 * 60 * 60)
    selected_page = pages[0] if pages else None

    if connection is None:
        connection = FacebookConnection(id=str(uuid.uuid4()), user_id=user_id)
        db.add(connection)

    connection.facebook_user_id = profile.get("id")
    connection.facebook_user_name = profile.get("name")
    connection.long_lived_user_token = encrypt_password(long_lived_token)
    connection.user_token_expires_at = expires_at
    connection.scopes = scopes
    connection.pages = pages
    connection.graph_version = settings.META_GRAPH_VERSION
    connection.token_health = {"status": "ok", "checked_at": datetime.now(timezone.utc).isoformat()}
    connection.status = "active"
    connection.last_token_check_at = datetime.now(timezone.utc)
    connection.last_successful_api_at = datetime.now(timezone.utc)

    if selected_page and (not connection.selected_page_id or not any(page.get("id") == connection.selected_page_id for page in pages)):
        connection.selected_page_id = selected_page.get("id")
        connection.selected_page_name = selected_page.get("name")
        connection.selected_page_access_token = selected_page.get("access_token")
    elif connection.selected_page_id:
        matched_page = next((page for page in pages if page.get("id") == connection.selected_page_id), None)
        if matched_page:
            connection.selected_page_name = matched_page.get("name")
            connection.selected_page_access_token = matched_page.get("access_token")

    await db.commit()
    await db.refresh(connection)
    return connection

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_data = UserResponse.model_validate(current_user)
    google_result = await db.execute(
        select(GoogleToolConnection).where(GoogleToolConnection.user_id == current_user.id)
    )
    google_connection = google_result.scalars().first()
    user_data.is_google_connected = bool(
        google_connection and (google_connection.refresh_token or google_connection.access_token) and (google_connection.status or "active") == "active"
    )
    user_data.is_google_tool_connected = user_data.is_google_connected
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
    fb_connection = result.scalars().first()
    user_data.is_facebook_connected = bool(
        fb_connection and fb_connection.selected_page_access_token and fb_connection.status == "active"
    )
    return user_data

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email đã được đăng ký."
        )
    
    # Create user
    db_user = User(
        id=str(uuid.uuid4()),
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        is_active=True,
        is_verified=False
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

@router.post("/login", response_model=Token)
async def login(
    response: Response,
    user_in: UserLogin, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    
    if not user or not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác."
        )
    
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    # Set refresh token in HttpOnly cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 3600, # 7 days
        samesite="lax",
        secure=False # Set to True in production
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/google", response_model=Token)
async def google_auth(
    response: Response,
    login_data: GoogleLogin,
    db: AsyncSession = Depends(get_db)
):
    email = None
    full_name = None
    google_id = None
    
    import httpx
    
    if login_data.code:
        # 1. Trao đổi code lấy access token cho đăng nhập OAuth cơ bản
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": login_data.code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": "postmessage", # Khi dùng @react-oauth/google code flow
                    "grant_type": "authorization_code",
                }
            )
            
            if token_resp.status_code == 200:
                tokens = token_resp.json()
                google_access_token = tokens.get("access_token")
                
                # 2. Lấy info user từ Google
                info_resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {google_access_token}"}
                )
                if info_resp.status_code == 200:
                    user_data = info_resp.json()
                    email = user_data.get("email")
                    full_name = user_data.get("name")
                    google_id = user_data.get("sub")
            else:
                logger.error(f"Google Code Exchange Error: {token_resp.text}")
                raise HTTPException(status_code=401, detail="Xác thực Google thất bại.")
                
    elif login_data.id_token:
        # Try verifying as ID Token (JWT) first
        try:
            id_info = id_token.verify_oauth2_token(
                login_data.id_token, 
                google_requests.Request(), 
                settings.GOOGLE_CLIENT_ID
            )
            email = id_info.get("email")
            full_name = id_info.get("name")
            google_id = id_info.get("sub")
        except Exception:
            # If ID Token verification fails, try as Access Token via UserInfo API
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {login_data.id_token}"}
                )
                if resp.status_code == 200:
                    user_data = resp.json()
                    email = user_data.get("email")
                    full_name = user_data.get("name")
                    google_id = user_data.get("sub")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Mã xác thực Google không hợp lệ hoặc đã hết hạn."
                    )
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không thể lấy thông tin email từ Google."
        )
        
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=full_name,
            hashed_password=None,
            is_active=True,
            is_verified=True,
            google_id=google_id
        )
        db.add(user)
    else:
        if google_id and not user.google_id:
            user.google_id = google_id
            
    await db.commit()
    await db.refresh(user)
        
    # Create tokens
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=7 * 24 * 3600,
        samesite="lax",
        secure=False
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }
 
@router.get("/google/connect")
async def google_connect(agent_id: str = None, current_user: User = Depends(get_current_user)):
    """Trả về URL OAuth2 để kết nối Gmail cho tool Google."""
    # Lưu cả user_id và agent_id vào state để quay lại đúng trang
    state = current_user.id
    if agent_id:
        state = f"{current_user.id}:{agent_id}"
        
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join([GOOGLE_BASIC_SCOPES, *GOOGLE_GMAIL_SCOPES]),
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.get("/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Xử lý callback từ Google và lưu tool connection Gmail tách biệt khỏi User."""
    import httpx
    
    # 1. Trao đổi code lấy tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            }
        )
        
        if token_resp.status_code != 200:
            logger.error(f"Google Token Exchange Error: {token_resp.text}")
            return RedirectResponse(f"{settings.ALLOWED_ORIGINS}/agents/create?error=token_exchange_failed")
            
        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)
        
        # 2. Cập nhật Google tool connection trong DB
        # Parse state để lấy user_id và agent_id
        user_id = state
        agent_id = None
        if ":" in state:
            user_id, agent_id = state.split(":", 1)
            
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if user:
            profile_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            profile = profile_resp.json() if profile_resp.status_code == 200 else {}

            connection_result = await db.execute(
                select(GoogleToolConnection).where(GoogleToolConnection.user_id == user_id)
            )
            connection = connection_result.scalars().first()
            if connection is None:
                connection = GoogleToolConnection(id=str(uuid.uuid4()), user_id=user_id)
                db.add(connection)

            connection.google_account_id = profile.get("sub") or user.google_id
            connection.google_account_email = profile.get("email") or user.email
            connection.access_token = access_token
            if refresh_token:
                connection.refresh_token = refresh_token
            connection.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            connection.scopes = GOOGLE_GMAIL_SCOPES
            connection.status = "active"
            await db.commit()
            
    # 3. Quay lại trang cấu hình Agent
    redirect_url = f"{settings.ALLOWED_ORIGINS}/connectors?google_tool_connected=success"
    if agent_id:
        redirect_url = f"{settings.ALLOWED_ORIGINS}/agents/create?id={agent_id}&google_tool_connected=success"
        
    return RedirectResponse(redirect_url)


@router.get("/facebook/connect")
async def facebook_connect(agent_id: str = None, current_user: User = Depends(get_current_user)):
    if not settings.FACEBOOK_APP_ID or not settings.FACEBOOK_APP_SECRET:
        raise HTTPException(status_code=400, detail="FACEBOOK_APP_ID/FACEBOOK_APP_SECRET chưa được cấu hình.")

    state = current_user.id
    if agent_id:
        state = f"{current_user.id}:{agent_id}"

    params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "redirect_uri": settings.FACEBOOK_REDIRECT_URI,
        "state": state,
        "response_type": "code",
        "scope": ",".join(
            [
                "pages_show_list",
                "pages_read_engagement",
                "pages_manage_posts",
                "pages_manage_engagement",
                "pages_messaging",
                "pages_manage_metadata",
            ]
        ),
    }
    url = f"https://www.facebook.com/{settings.META_GRAPH_VERSION}/dialog/oauth?{urllib.parse.urlencode(params)}"
    return {"url": url}


@router.get("/facebook/callback")
async def facebook_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    user_id = state
    agent_id = None
    if ":" in state:
        user_id, agent_id = state.split(":", 1)

    short_lived = await exchange_facebook_code_for_short_lived_token(code)
    short_lived_token = short_lived.get("access_token")
    if not short_lived_token:
        raise HTTPException(status_code=400, detail="Facebook không trả về access token.")

    long_lived = await exchange_for_long_lived_user_token(short_lived_token)
    long_lived_token = long_lived.get("access_token")
    expires_in = long_lived.get("expires_in", 60 * 24 * 60 * 60)

    profile, pages = await fetch_facebook_profile_and_pages(long_lived_token)

    await upsert_facebook_connection(
        db=db,
        user_id=user_id,
        profile=profile,
        pages=pages,
        long_lived_token=long_lived_token,
        expires_in=expires_in,
        scopes=[
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_posts",
            "pages_manage_engagement",
            "pages_messaging",
            "pages_manage_metadata",
        ],
    )

    redirect_url = f"{settings.ALLOWED_ORIGINS}/connectors?facebook_connected=success"
    if agent_id:
        redirect_url = f"{settings.ALLOWED_ORIGINS}/agents/create?id={agent_id}&facebook_connected=success"
    return RedirectResponse(redirect_url)


@router.get("/facebook/status")
async def facebook_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
    connection = result.scalars().first()
    if not connection:
        return {
            "connected": False,
            "status": "not_connected",
            "selected_page_id": None,
            "selected_page_name": None,
            "pages_count": 0,
        }

    return {
        "connected": bool(connection.selected_page_access_token and connection.status == "active"),
        "status": connection.status,
        "selected_page_id": connection.selected_page_id,
        "selected_page_name": connection.selected_page_name,
        "pages_count": len(connection.pages or []),
        "expires_at": connection.user_token_expires_at,
    }


@router.get("/facebook/pages")
async def facebook_pages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Bạn chưa kết nối Facebook.")

    return {
        "status": connection.status,
        "selected_page_id": connection.selected_page_id,
        "selected_page_name": connection.selected_page_name,
        "graph_version": connection.graph_version,
        "token_health": connection.token_health,
        "last_sync_at": connection.last_sync_at,
        "pages": [
            {k: v for k, v in page.items() if k != "access_token"}
            for page in (connection.pages or [])
        ],
    }


class FacebookSelectPageRequest(BaseModel):
    page_id: str


class ConnectorToggleRequest(BaseModel):
    enabled: bool


@router.post("/facebook/select-page")
async def facebook_select_page(
    payload: FacebookSelectPageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
    connection = result.scalars().first()
    if not connection:
        raise HTTPException(status_code=404, detail="Bạn chưa kết nối Facebook.")

    matched_page = next((page for page in (connection.pages or []) if page.get("id") == payload.page_id), None)
    if not matched_page:
        raise HTTPException(status_code=404, detail="Không tìm thấy Facebook Page đã chọn.")

    connection.selected_page_id = matched_page.get("id")
    connection.selected_page_name = matched_page.get("name")
    connection.selected_page_access_token = matched_page.get("access_token")
    connection.status = "active"
    connection.last_successful_api_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(connection)

    return {
        "success": True,
        "selected_page_id": connection.selected_page_id,
        "selected_page_name": connection.selected_page_name,
    }


@router.get("/connectors")
async def list_oauth_connectors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    google_result = await db.execute(
        select(GoogleToolConnection).where(GoogleToolConnection.user_id == current_user.id)
    )
    google_connection = google_result.scalars().first()

    fb_result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
    fb_connection = fb_result.scalars().first()

    google_connected = bool(google_connection and (google_connection.refresh_token or google_connection.access_token))
    google_enabled = bool(google_connected and (google_connection.status or "active") == "active")

    facebook_connected = bool(fb_connection and fb_connection.selected_page_access_token)
    facebook_enabled = bool(facebook_connected and (fb_connection.status or "active") == "active")

    return {
        "items": [
            {
                "key": "facebook",
                "label": "Facebook",
                "description": "Kết nối Fanpage và Messenger",
                "connected": facebook_connected,
                "enabled": facebook_enabled,
                "status": (fb_connection.status if fb_connection else "disconnected"),
                "account": fb_connection.facebook_user_name if fb_connection else None,
                "meta": {
                    "selected_page_id": fb_connection.selected_page_id if fb_connection else None,
                    "selected_page_name": fb_connection.selected_page_name if fb_connection else None,
                },
            },
            {
                "key": "gmail",
                "label": "Gmail",
                "description": "Đọc, gửi và quản lý email",
                "connected": google_connected,
                "enabled": google_enabled,
                "status": (google_connection.status if google_connection else "disconnected"),
                "account": google_connection.google_account_email if google_connection else None,
                "meta": {},
            },
        ]
    }


@router.post("/connectors/{provider}/toggle")
async def toggle_oauth_connector(
    provider: str,
    payload: ConnectorToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider == "facebook":
        result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
        conn = result.scalars().first()
        if not conn:
            raise HTTPException(status_code=404, detail="Facebook connector chưa được kết nối.")
        conn.status = "active" if payload.enabled else "disabled"
        await db.commit()
        return {"success": True, "provider": "facebook", "enabled": payload.enabled, "status": conn.status}

    if provider == "gmail":
        result = await db.execute(select(GoogleToolConnection).where(GoogleToolConnection.user_id == current_user.id))
        conn = result.scalars().first()
        if not conn:
            raise HTTPException(status_code=404, detail="Gmail connector chưa được kết nối.")
        conn.status = "active" if payload.enabled else "disabled"
        await db.commit()
        return {"success": True, "provider": "gmail", "enabled": payload.enabled, "status": conn.status}

    raise HTTPException(status_code=400, detail="Provider không hỗ trợ.")


@router.post("/connectors/{provider}/reset")
async def reset_oauth_connector(
    provider: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = provider.lower().strip()
    if provider == "facebook":
        result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == current_user.id))
        conn = result.scalars().first()
        if conn:
            await db.delete(conn)
            await db.commit()
        return {"success": True, "provider": "facebook", "status": "disconnected"}

    if provider == "gmail":
        result = await db.execute(select(GoogleToolConnection).where(GoogleToolConnection.user_id == current_user.id))
        conn = result.scalars().first()
        if conn:
            await db.delete(conn)
            await db.commit()
        return {"success": True, "provider": "gmail", "status": "disconnected"}

    raise HTTPException(status_code=400, detail="Provider không hỗ trợ.")

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"success": True, "message": "Đã đăng xuất thành công."}

@router.post("/refresh", response_model=Token)
async def refresh_token(request: Request, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
        )
    
    try:
        from jose import jwt
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Token không hợp lệ.")
            
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if user is None:
            raise HTTPException(status_code=401, detail="Người dùng không tồn tại.")
            
        access_token = create_access_token(subject=user.id)
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    except Exception:
        raise HTTPException(status_code=401, detail="Token đã hết hạn hoặc không hợp lệ.")
