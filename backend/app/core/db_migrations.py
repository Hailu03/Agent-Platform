import uuid
import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def run_startup_migrations(conn: AsyncConnection) -> None:
    await _migrate_facebook_manager_mvp(conn)
    await _migrate_google_tool_connections(conn)


async def _migrate_facebook_manager_mvp(conn: AsyncConnection) -> None:
    await conn.execute(text("ALTER TABLE facebook_connections ADD COLUMN IF NOT EXISTS graph_version VARCHAR"))
    await conn.execute(text("ALTER TABLE facebook_connections ADD COLUMN IF NOT EXISTS token_health JSON"))
    await conn.execute(text("ALTER TABLE facebook_connections ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE"))
    await conn.execute(text("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS artifacts JSON"))


async def _migrate_google_tool_connections(conn: AsyncConnection) -> None:
    columns_result = await conn.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            """
        )
    )
    user_columns = {row[0] for row in columns_result.fetchall()}
    legacy_columns = {"google_access_token", "google_refresh_token", "google_token_expiry"}

    if not legacy_columns.intersection(user_columns):
        return

    rows = await conn.execute(
        text(
            """
            SELECT id, email, google_id, google_access_token, google_refresh_token, google_token_expiry
            FROM users
            WHERE google_access_token IS NOT NULL OR google_refresh_token IS NOT NULL
            """
        )
    )

    existing_result = await conn.execute(text("SELECT user_id FROM google_tool_connections"))
    existing_user_ids = {row[0] for row in existing_result.fetchall()}

    for row in rows.fetchall():
        user_id, email, google_id, access_token, refresh_token, token_expiry = row
        if user_id in existing_user_ids:
            continue

        await conn.execute(
            text(
                """
                INSERT INTO google_tool_connections (
                    id,
                    user_id,
                    google_account_id,
                    google_account_email,
                    access_token,
                    refresh_token,
                    token_expiry,
                    scopes,
                    status
                ) VALUES (
                    :id,
                    :user_id,
                    :google_account_id,
                    :google_account_email,
                    :access_token,
                    :refresh_token,
                    :token_expiry,
                    CAST(:scopes AS JSON),
                    :status
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "google_account_id": google_id,
                "google_account_email": email,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "token_expiry": token_expiry,
                "scopes": json.dumps(
                    [
                        "https://www.googleapis.com/auth/gmail.modify",
                        "https://www.googleapis.com/auth/gmail.send",
                    ]
                ),
                "status": "active",
            },
        )

    for column_name in sorted(legacy_columns.intersection(user_columns)):
        await conn.execute(text(f"ALTER TABLE users DROP COLUMN IF EXISTS {column_name}"))
