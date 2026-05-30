from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete
from app.models.datasource import DataSource
from app.models.semantic import SemanticTable, SemanticColumn, SemanticRelationship
from typing import List, Optional

class DataSourceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, ds_id: str, user_id: Optional[str] = None) -> Optional[DataSource]:
        query = select(DataSource).where(DataSource.id == ds_id)
        if user_id:
            query = query.where(DataSource.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_all(self, user_id: Optional[str] = None) -> List[DataSource]:
        query = select(DataSource)
        if user_id:
            query = query.where(DataSource.user_id == user_id)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def delete(self, ds_id: str, user_id: Optional[str] = None):
        """Xóa sạch dữ liệu datasource và các bảng semantic liên quan"""
        # Validate that user owns this datasource before deleting
        if user_id:
            ds = await self.get_by_id(ds_id, user_id=user_id)
            if not ds:
                return

        # 1. Xóa các quan hệ semantic trước
        await self.db.execute(sa_delete(SemanticRelationship).where(SemanticRelationship.datasource_id == ds_id))
        await self.db.execute(sa_delete(SemanticColumn).where(
            SemanticColumn.table_id.in_(
                select(SemanticTable.id).where(SemanticTable.datasource_id == ds_id)
            )
        ))
        await self.db.execute(sa_delete(SemanticTable).where(SemanticTable.datasource_id == ds_id))
        
        # 2. Xóa datasource chính
        await self.db.execute(sa_delete(DataSource).where(DataSource.id == ds_id))
        await self.db.commit()
