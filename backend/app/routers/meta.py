import hashlib
import hmac
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.config import settings

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
async def receive_webhook(request: Request):
    raw_body = await request.body()
    payload = await request.json()
    signature_valid = verify_meta_signature(raw_body, request.headers.get("x-hub-signature-256"))
    if settings.FACEBOOK_APP_SECRET and not signature_valid:
        raise HTTPException(status_code=403, detail="Invalid Meta webhook signature.")
    normalized = normalize_webhook_event(payload)
    return {"success": True, "signature_valid": signature_valid, "event": normalized}
