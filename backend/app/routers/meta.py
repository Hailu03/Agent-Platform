import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.security import decrypt_password, get_current_user
from app.models.base import get_db
from app.models.facebook_assets import AgentArtifact as AgentArtifactModel, MetaWebhookEvent
from app.models.facebook_connection import FacebookConnection
from app.models.user import User
from app.services.facebook_manager import FacebookPageService, MessengerService
from app.services.meta_graph import MetaGraphClient, MetaGraphError

router = APIRouter(prefix="/meta", tags=["Meta"])


def verify_meta_signature(raw_body: bytes, signature: str | None) -> bool:
    if not settings.FACEBOOK_APP_SECRET:
        return False
    if not signature or not signature.startswith("sha256="):
        return False
    expected = hmac.new(settings.FACEBOOK_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    supplied = signature.split("=", 1)[1]
    return hmac.compare_digest(expected, supplied)


def normalize_webhook_event(payload: dict[str, Any]) -> dict[str, Any]:
    entries = payload.get("entry") or []
    first_entry = entries[0] if entries else {}
    page_id = first_entry.get("id")
    if first_entry.get("messaging"):
        messaging = first_entry["messaging"][0]
        return {
            "page_id": page_id,
            "event_type": "message",
            "sender_id": (messaging.get("sender") or {}).get("id"),
            "recipient_id": (messaging.get("recipient") or {}).get("id"),
            "message": (messaging.get("message") or {}).get("text"),
            "timestamp": messaging.get("timestamp"),
        }
    changes = first_entry.get("changes") or []
    if changes:
        change = changes[0]
        value = change.get("value") or {}
        return {
            "page_id": page_id or value.get("page_id"),
            "event_type": change.get("field") or value.get("item") or "change",
            "item": value.get("item"),
            "verb": value.get("verb"),
            "post_id": value.get("post_id"),
            "comment_id": value.get("comment_id"),
            "sender_id": value.get("sender_id") or value.get("from", {}).get("id"),
            "message": value.get("message"),
            "created_time": value.get("created_time"),
        }
    return {"page_id": page_id, "event_type": payload.get("object", "unknown")}


async def _get_connection(db: AsyncSession, user_id: str) -> FacebookConnection:
    result = await db.execute(select(FacebookConnection).where(FacebookConnection.user_id == user_id))
    connection = result.scalars().first()
    if not connection or not connection.selected_page_access_token:
        raise HTTPException(status_code=404, detail="Bạn chưa kết nối Facebook Page.")
    return connection


def _client_from_connection(connection: FacebookConnection) -> tuple[str, MetaGraphClient]:
    page_id = connection.selected_page_id
    token = decrypt_password(connection.selected_page_access_token or "")
    if not page_id or not token:
        raise HTTPException(status_code=400, detail="Facebook Page connection chưa có page/token hợp lệ.")
    return page_id, MetaGraphClient(token, graph_version=connection.graph_version or settings.META_GRAPH_VERSION)


@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    expected_token = settings.META_WEBHOOK_VERIFY_TOKEN or settings.FACEBOOK_APP_SECRET
    if mode == "subscribe" and token and expected_token and hmac.compare_digest(token, expected_token):
        return PlainTextResponse(challenge or "")
    raise HTTPException(status_code=403, detail="Invalid Meta webhook verification token.")


@router.post("/webhook")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    raw_body = await request.body()
    payload = await request.json()
    signature_valid = verify_meta_signature(raw_body, request.headers.get("x-hub-signature-256"))
    if settings.FACEBOOK_APP_SECRET and not signature_valid:
        raise HTTPException(status_code=403, detail="Invalid Meta webhook signature.")
    normalized = normalize_webhook_event(payload)
    event = MetaWebhookEvent(
        object_type=payload.get("object"),
        page_id=normalized.get("page_id"),
        event_type=normalized.get("event_type"),
        normalized_payload=normalized,
        raw_payload=payload,
        signature_valid=signature_valid,
        processed=False,
    )
    db.add(event)
    await db.commit()
    return {"success": True, "signature_valid": signature_valid}


@router.get("/fanpage/status")
async def fanpage_status(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    connection = await _get_connection(db, current_user.id)
    return {
        "connected": True,
        "selected_page_id": connection.selected_page_id,
        "selected_page_name": connection.selected_page_name,
        "graph_version": connection.graph_version or settings.META_GRAPH_VERSION,
        "token_health": connection.token_health,
        "last_sync_at": connection.last_sync_at,
        "webhook_configured": bool(settings.META_WEBHOOK_VERIFY_TOKEN or settings.FACEBOOK_APP_SECRET),
        "scopes": connection.scopes or [],
    }


@router.get("/fanpage/dashboard")
async def fanpage_dashboard(
    since: Optional[str] = None,
    until: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await _get_connection(db, current_user.id)
    page_id, client = _client_from_connection(connection)
    try:
        artifacts = await FacebookPageService(client, page_id).generate_dashboard(since=since, until=until)
    except MetaGraphError as exc:
        raise HTTPException(status_code=400, detail=exc.to_dict())

    connection.last_sync_at = datetime.now(timezone.utc)
    for artifact in artifacts:
        db.add(
            AgentArtifactModel(
                user_id=current_user.id,
                provider=artifact.source.provider,
                tool=artifact.source.tool,
                type=artifact.type,
                title=artifact.title,
                payload=artifact.model_dump(),
            )
        )
    await db.commit()
    return {"artifacts": [artifact.model_dump() for artifact in artifacts]}


@router.get("/fanpage/conversations")
async def fanpage_conversations(limit: int = 20, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    connection = await _get_connection(db, current_user.id)
    page_id, client = _client_from_connection(connection)
    try:
        return {"conversations": await MessengerService(client, page_id).list_conversations(limit=limit)}
    except MetaGraphError as exc:
        raise HTTPException(status_code=400, detail=exc.to_dict())


@router.get("/fanpage/comments/unreplied")
async def fanpage_unreplied_comments(
    post_id: Optional[str] = None,
    limit: int = 25,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    connection = await _get_connection(db, current_user.id)
    page_id, client = _client_from_connection(connection)
    try:
        return {"comments": await FacebookPageService(client, page_id).list_unreplied_comments(post_id=post_id, limit=limit)}
    except MetaGraphError as exc:
        raise HTTPException(status_code=400, detail=exc.to_dict())


@router.get("/fanpage/posts")
async def fanpage_posts(limit: int = 20, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    connection = await _get_connection(db, current_user.id)
    page_id, client = _client_from_connection(connection)
    try:
        return {"posts": await FacebookPageService(client, page_id).list_posts(limit=limit)}
    except MetaGraphError as exc:
        raise HTTPException(status_code=400, detail=exc.to_dict())
