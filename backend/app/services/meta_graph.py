from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Optional

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class MetaGraphError(Exception):
    message: str
    code: Optional[int] = None
    subcode: Optional[int] = None
    type: Optional[str] = None
    provider: str = "meta"
    is_retryable: bool = False
    action_required: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "code": self.code,
            "subcode": self.subcode,
            "type": self.type,
            "message": self.message,
            "is_retryable": self.is_retryable,
            "action_required": self.action_required,
        }


def normalize_meta_error(data: dict[str, Any], status_code: int = 400) -> MetaGraphError:
    error = data.get("error") if isinstance(data, dict) else {}
    code = error.get("code")
    subcode = error.get("error_subcode")
    message = error.get("message") or "Meta Graph API request failed."
    err_type = error.get("type")
    retryable_codes = {1, 2, 4, 17, 32, 613}
    action_required = None

    message_lc = message.lower()

    if subcode == 2018464 or "conversation routing is not enabled" in message_lc:
        action_required = "conversation_routing_not_enabled"
    elif subcode == 2018300 or "another app is controlling this thread" in message_lc or "another app is controlling this conversation" in message_lc:
        action_required = "thread_control"
    elif subcode == 2018151 or "calling app is not the thread owner" in message_lc:
        action_required = "not_thread_owner"
    elif status_code in {401, 403} or code in {190, 200, 10}:
        action_required = "reauthorize" if code == 190 else "permission_missing"
    elif code in {4, 17, 32, 613} or status_code == 429:
        action_required = "rate_limited"
    elif "review" in message_lc:
        action_required = "app_review"
    elif "pass_thread_control" in message_lc or "take_thread_control" in message_lc:
        action_required = "thread_control"
    elif "outside the allowed window" in message_lc or "24 hour" in message_lc:
        action_required = "messaging_window"

    return MetaGraphError(
        message=message,
        code=code,
        subcode=subcode,
        type=err_type,
        is_retryable=bool(code in retryable_codes or status_code >= 500),
        action_required=action_required,
    )


class MetaGraphClient:
    def __init__(self, access_token: str, graph_version: Optional[str] = None):
        self.access_token = access_token
        self.graph_version = graph_version or settings.META_GRAPH_VERSION or "v25.0"
        self.base_url = f"https://graph.facebook.com/{self.graph_version}"

    async def request(
        self,
        method: str,
        path: str,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        merged_params = dict(params or {})
        merged_params.setdefault("access_token", self.access_token)
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.request(method, url, params=merged_params, json=json)

        try:
            data = response.json()
        except Exception:
            data = {"error": {"message": response.text or "Invalid Meta response"}}

        if response.status_code >= 400 or (isinstance(data, dict) and data.get("error")):
            normalized_error = normalize_meta_error(data, response.status_code)
            logger.error(
                "Meta Graph API error | method=%s path=%s status=%s code=%s subcode=%s type=%s action_required=%s message=%s response=%s",
                method,
                path,
                response.status_code,
                normalized_error.code,
                normalized_error.subcode,
                normalized_error.type,
                normalized_error.action_required,
                normalized_error.message,
                data,
            )
            raise normalized_error
        return data

    async def get(self, path: str, **params: Any) -> dict[str, Any]:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, params: Optional[dict[str, Any]] = None, json: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        return await self.request("POST", path, params=params, json=json)

    async def delete(self, path: str, **params: Any) -> dict[str, Any]:
        return await self.request("DELETE", path, params=params)

    async def paginate(
        self,
        path: str,
        params: Optional[dict[str, Any]] = None,
        max_pages: int = 3,
    ) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        next_url: Optional[str] = None
        current_params = dict(params or {})

        for page_index in range(max_pages):
            if next_url:
                data = await self.request("GET", next_url, params={})
            else:
                data = await self.request("GET", path, params=current_params)
            items.extend(data.get("data", []))
            next_url = data.get("paging", {}).get("next")
            if not next_url:
                break
        return items

    async def batch(self, requests: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        data = await self.post("/", params={"batch": list(requests)})
        return data if isinstance(data, list) else []
