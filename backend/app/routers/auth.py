from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import settings
from app.models.base import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, GoogleLogin
from app.core.security import create_access_token, create_refresh_token, verify_password, get_password_hash, get_current_user
from fastapi.responses import RedirectResponse
import urllib.parse
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    user_data = UserResponse.model_validate(current_user)
    user_data.is_google_connected = bool(current_user.google_refresh_token)
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
    google_access_token = None
    google_refresh_token = None
    google_token_expiry = None
    
    import httpx
    
    if login_data.code:
        # 1. Trao đổi code lấy tokens (bao gồm cả refresh_token nếu scope đủ)
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
                google_refresh_token = tokens.get("refresh_token")
                expires_in = tokens.get("expires_in", 3600)
                from datetime import datetime, timedelta, timezone
                google_token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
                
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
            google_id=google_id,
            google_access_token=google_access_token,
            google_refresh_token=google_refresh_token,
            google_token_expiry=google_token_expiry
        )
        db.add(user)
    else:
        # Cập nhật tokens nếu có
        if google_access_token:
            user.google_access_token = google_access_token
            if google_refresh_token:
                user.google_refresh_token = google_refresh_token
            user.google_token_expiry = google_token_expiry
            
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
    """Trả về URL OAuth2 để kết nối Gmail"""
    # Lưu cả user_id và agent_id vào state để quay lại đúng trang
    state = current_user.id
    if agent_id:
        state = f"{current_user.id}:{agent_id}"
        
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send",
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"
    return {"url": url}

@router.get("/google/callback")
async def google_callback(code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Xử lý callback từ Google và lưu tokens"""
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
        
        # 2. Cập nhật User trong DB
        # Parse state để lấy user_id và agent_id
        user_id = state
        agent_id = None
        if ":" in state:
            user_id, agent_id = state.split(":", 1)
            
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if user:
            user.google_access_token = access_token
            if refresh_token: # Google chỉ gửi refresh_token lần đầu hoặc khi prompt=consent
                user.google_refresh_token = refresh_token
            from datetime import datetime, timedelta, timezone
            user.google_token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            await db.commit()
            
    # 3. Quay lại trang cấu hình Agent
    redirect_url = f"{settings.ALLOWED_ORIGINS}/agents/create?google_connected=success"
    if agent_id:
        redirect_url = f"{settings.ALLOWED_ORIGINS}/agents/create?id={agent_id}&google_connected=success"
        
    return RedirectResponse(redirect_url)

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
