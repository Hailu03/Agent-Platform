from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.base import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.guardrails import SystemGuardrails
from app.schemas.guardrails import GuardrailsUpdate, GuardrailsResponse

router = APIRouter(prefix="/guardrails", tags=["Guardrails"])

@router.get("/system", response_model=GuardrailsResponse)
async def get_system_guardrails(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SystemGuardrails).limit(1))
    guardrails = result.scalars().first()

    if not guardrails:
        guardrails = SystemGuardrails()
        db.add(guardrails)
        await db.commit()
        await db.refresh(guardrails)

    return guardrails

@router.put("/system", response_model=GuardrailsResponse)
async def update_system_guardrails(
    payload: GuardrailsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SystemGuardrails).limit(1))
    guardrails = result.scalars().first()

    if not guardrails:
        guardrails = SystemGuardrails()
        db.add(guardrails)

    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(guardrails, key, value)

    await db.commit()
    await db.refresh(guardrails)

    return guardrails
