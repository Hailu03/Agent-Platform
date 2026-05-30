from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any, Optional

from app.schemas.artifact import AgentArtifact, AgentArtifactDisplay, AgentArtifactSource
from app.services.meta_graph import MetaGraphClient, MetaGraphError


def normalize_name(value: str | None) -> str:
    value = value or ""
    value = unicodedata.normalize("NFKD", value)
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"\s+", " ", value).strip().lower()
    return value


def parse_time(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


class FacebookSafeResponse:
    @staticmethod
    def ok(message: str, data: Any = None, artifacts: Optional[list[AgentArtifact]] = None) -> str:
        payload = {
            "success": True,
            "message": message,
            "data": data,
            "artifacts": [artifact.model_dump() for artifact in artifacts or []],
        }
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def error(message: str, error: Any = None, data: Any = None) -> str:
        payload = {
            "success": False,
            "message": message,
            "data": data,
            "error": error.to_dict() if hasattr(error, "to_dict") else error,
        }
        return json.dumps(payload, ensure_ascii=False)


class FacebookPageService:
    def __init__(self, client: MetaGraphClient, page_id: str):
        self.client = client
        self.page_id = page_id

    async def list_posts(self, limit: int = 10, since: str | None = None, until: str | None = None) -> list[dict[str, Any]]:
        params: dict[str, Any] = {
            "fields": "id,message,created_time,shares,likes.summary(true),comments.summary(true)",
            "limit": limit,
        }
        if since:
            params["since"] = since
        if until:
            params["until"] = until
        posts = await self.client.paginate(f"{self.page_id}/posts", params=params, max_pages=2)
        return [self._normalize_post(post) for post in posts[:limit]]

    async def create_post(self, message: str, link: str | None = None, image_url: str | None = None) -> dict[str, Any]:
        if image_url:
            return await self.client.post(f"{self.page_id}/photos", params={"url": image_url, "caption": message})
        params = {"message": message}
        if link:
            params["link"] = link
        return await self.client.post(f"{self.page_id}/feed", params=params)

    async def list_comments(self, post_id: str, limit: int = 25) -> list[dict[str, Any]]:
        comments = await self.client.paginate(
            f"{post_id}/comments",
            params={
                "fields": "id,message,from,created_time,can_reply,is_hidden,comments.limit(10){id,message,from,created_time}",
                "limit": limit,
                "filter": "stream",
            },
            max_pages=2,
        )
        return [self._normalize_comment(comment, post_id=post_id) for comment in comments[:limit]]

    async def list_unreplied_comments(
        self,
        post_id: str | None = None,
        limit: int = 25,
        since: str | None = None,
    ) -> list[dict[str, Any]]:
        comments: list[dict[str, Any]] = []
        if post_id:
            comments = await self.list_comments(post_id, limit=limit)
        else:
            posts = await self.list_posts(limit=10, since=since)
            for post in posts:
                comments.extend(await self.list_comments(post["id"], limit=10))
                if len(comments) >= limit:
                    break

        page_token = self.page_id
        unreplied = []
        for comment in comments:
            replies = comment.get("replies") or []
            has_page_reply = any((reply.get("author_id") == page_token) or (reply.get("author_name") == comment.get("page_name")) for reply in replies)
            if not has_page_reply:
                unreplied.append(comment)
        return unreplied[:limit]

    async def reply_comment(self, comment_id: str, message: str) -> dict[str, Any]:
        return await self.client.post(f"{comment_id}/comments", params={"message": message})

    async def hide_comment(self, comment_id: str, hide: bool = True) -> dict[str, Any]:
        return await self.client.post(comment_id, params={"is_hidden": "true" if hide else "false"})

    async def get_insights(self, metrics: list[str] | None = None, since: str | None = None, until: str | None = None) -> list[dict[str, Any]]:
        metrics = metrics or ["page_impressions", "page_engaged_users", "page_fans"]
        params: dict[str, Any] = {"metric": ",".join(metrics), "period": "day"}
        if since:
            params["since"] = since
        if until:
            params["until"] = until
        data = await self.client.get(f"{self.page_id}/insights", **params)
        return data.get("data", [])

    async def get_page_profile(self) -> dict[str, Any]:
        return await self.client.get(self.page_id, fields="id,name,category,fan_count,followers_count")

    async def generate_dashboard(self, since: str | None = None, until: str | None = None) -> list[AgentArtifact]:
        profile = await self.get_page_profile()
        posts = await self.list_posts(limit=10, since=since, until=until)
        unreplied = await self.list_unreplied_comments(limit=20, since=since)
        insights = await self.get_insights(since=since, until=until)
        insight_rows = self._flatten_insights(insights)

        metric_values = {
            "fans": profile.get("fan_count") or profile.get("followers_count") or 0,
            "impressions": self._latest_metric_value(insights, "page_impressions"),
            "engaged_users": self._latest_metric_value(insights, "page_engaged_users"),
            "unreplied_comments": len(unreplied),
            "posts": len(posts),
        }

        source = AgentArtifactSource(provider="meta", tool="facebook_generate_dashboard")
        return [
            AgentArtifact(
                type="metric_grid",
                title=f"Tổng quan Fanpage {profile.get('name') or self.page_id}",
                source=source,
                data=[
                    {"label": "Followers/Fans", "value": metric_values["fans"]},
                    {"label": "Impressions", "value": metric_values["impressions"]},
                    {"label": "Engaged users", "value": metric_values["engaged_users"]},
                    {"label": "Comments chưa trả lời", "value": metric_values["unreplied_comments"]},
                    {"label": "Bài viết đã đọc", "value": metric_values["posts"]},
                ],
                display=AgentArtifactDisplay(renderer="metric_grid"),
            ),
            AgentArtifact(
                type="chart",
                title="Impressions và engagement theo ngày",
                source=source,
                data=insight_rows,
                display=AgentArtifactDisplay(renderer="line", x="date", y=["page_impressions", "page_engaged_users"]),
            ),
            AgentArtifact(
                type="chart",
                title="Top posts theo tương tác",
                source=source,
                data=[
                    {
                        "post": (post.get("message") or post.get("id") or "")[:42],
                        "comments": post.get("comments_count", 0),
                        "reactions": post.get("reactions_count", 0),
                        "shares": post.get("shares_count", 0),
                    }
                    for post in posts
                ],
                display=AgentArtifactDisplay(renderer="bar", x="post", y=["comments", "reactions", "shares"]),
            ),
            AgentArtifact(
                type="table",
                title="Comments chưa trả lời",
                source=source,
                data=unreplied,
                display=AgentArtifactDisplay(renderer="table"),
            ),
        ]

    def _normalize_post(self, post: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": post.get("id"),
            "message": post.get("message") or "",
            "created_time": post.get("created_time"),
            "shares_count": (post.get("shares") or {}).get("count", 0),
            "reactions_count": ((post.get("likes") or {}).get("summary") or {}).get("total_count", 0),
            "comments_count": ((post.get("comments") or {}).get("summary") or {}).get("total_count", 0),
            "raw": post,
        }

    def _normalize_comment(self, comment: dict[str, Any], post_id: str | None = None) -> dict[str, Any]:
        author = comment.get("from") or {}
        replies = [
            self._normalize_comment(reply, post_id=post_id)
            for reply in ((comment.get("comments") or {}).get("data") or [])
        ]
        return {
            "id": comment.get("id"),
            "post_id": post_id,
            "message": comment.get("message") or "",
            "author_id": author.get("id"),
            "author_name": author.get("name"),
            "created_time": comment.get("created_time"),
            "can_reply": comment.get("can_reply", True),
            "is_hidden": comment.get("is_hidden", False),
            "replies": replies,
            "raw": comment,
        }

    def _flatten_insights(self, insights: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_date: dict[str, dict[str, Any]] = {}
        for metric in insights:
            name = metric.get("name")
            for value in metric.get("values", []):
                date = (value.get("end_time") or "")[:10] or datetime.now(timezone.utc).date().isoformat()
                by_date.setdefault(date, {"date": date})
                raw_value = value.get("value", 0)
                by_date[date][name] = raw_value if isinstance(raw_value, (int, float)) else 0
        return list(by_date.values())

    def _latest_metric_value(self, insights: list[dict[str, Any]], metric_name: str) -> int:
        for metric in insights:
            if metric.get("name") == metric_name and metric.get("values"):
                value = metric["values"][-1].get("value", 0)
                return value if isinstance(value, int) else 0
        return 0


class MessengerService:
    def __init__(self, client: MetaGraphClient, page_id: str):
        self.client = client
        self.page_id = page_id

    async def list_conversations(self, limit: int = 10) -> list[dict[str, Any]]:
        conversations = await self.client.paginate(
            f"{self.page_id}/conversations",
            params={
                "fields": "id,participants,messages.limit(1){message,from,created_time},updated_time",
                "limit": limit,
            },
            max_pages=2,
        )
        return [self._normalize_conversation(conversation) for conversation in conversations[:limit]]

    async def send_text(self, recipient_id: str, message_text: str) -> dict[str, Any]:
        return await self.client.post(
            f"{self.page_id}/messages",
            json={
                "messaging_type": "RESPONSE",
                "recipient": {"id": recipient_id},
                "message": {"text": message_text},
            },
        )

    async def request_thread_control(self, recipient_id: str, metadata: str | None = None) -> dict[str, Any]:
        return await self.client.post(
            f"{self.page_id}/request_thread_control",
            params={
                "recipient": json.dumps({"id": recipient_id}),
                "metadata": metadata or "OpenClaw requests thread control",
            },
        )

    def _normalize_conversation(self, conversation: dict[str, Any]) -> dict[str, Any]:
        participants = (conversation.get("participants") or {}).get("data") or []
        customer = next((item for item in participants if item.get("id") != self.page_id), participants[0] if participants else {})
        latest = ((conversation.get("messages") or {}).get("data") or [{}])[0]
        return {
            "id": conversation.get("id"),
            "participant_id": customer.get("id"),
            "participant_name": customer.get("name"),
            "updated_time": conversation.get("updated_time"),
            "last_message": latest.get("message") or "",
            "raw": conversation,
        }


class MetaIdentityResolver:
    def __init__(self, messenger: MessengerService):
        self.messenger = messenger

    async def find_contact(self, query: str, limit: int = 10) -> dict[str, Any]:
        normalized_query = normalize_name(query)
        conversations = await self.messenger.list_conversations(limit=50)
        candidates = []
        for conversation in conversations:
            name = conversation.get("participant_name") or ""
            normalized_name = normalize_name(name)
            if not normalized_query or normalized_query in normalized_name or normalized_name in normalized_query:
                score = 100 if normalized_name == normalized_query else 70
                if normalized_name.startswith(normalized_query):
                    score += 10
                candidates.append({
                    "recipient_id": conversation.get("participant_id"),
                    "name": name,
                    "conversation_id": conversation.get("id"),
                    "last_message": conversation.get("last_message"),
                    "updated_time": conversation.get("updated_time"),
                    "score": score,
                    "source": "conversation",
                })
        candidates.sort(key=lambda item: (item.get("score") or 0, item.get("updated_time") or ""), reverse=True)
        exact = [candidate for candidate in candidates if normalize_name(candidate.get("name")) == normalized_query]
        return {
            "query": query,
            "matched": exact[0] if len(exact) == 1 else (candidates[0] if len(candidates) == 1 else None),
            "candidates": candidates[:limit],
            "ambiguous": len(candidates) > 1 and len(exact) != 1,
        }
