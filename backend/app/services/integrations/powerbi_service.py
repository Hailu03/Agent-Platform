import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class PowerBIService:
    BASE_URL = "https://api.powerbi.com/v1.0/myorg"
    AUTH_URL = "https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"

    @staticmethod
    async def get_access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
        """Acquires an access token using Client Credentials flow."""
        url = PowerBIService.AUTH_URL.format(tenant_id=tenant_id)
        data = {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "https://analysis.windows.net/powerbi/api/.default"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, data=data)
            if response.status_code != 200:
                logger.error(f"Failed to get Power BI token: {response.text}")
                raise Exception(f"Power BI Auth failed: {response.status_code}")
            
            return response.json().get("access_token")

    @staticmethod
    async def execute_query(
        workspace_id: str, 
        dataset_id: str, 
        dax_query: str, 
        token: str
    ) -> List[Dict[str, Any]]:
        """Executes a DAX query against a Power BI dataset."""
        url = f"{PowerBIService.BASE_URL}/groups/{workspace_id}/datasets/{dataset_id}/executeQueries"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        payload = {
            "queries": [{"query": dax_query}],
            "serializerSettings": {"includeNulls": True}
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            if response.status_code != 200:
                logger.error(f"Power BI Query execution failed: {response.text}")
                raise Exception(f"Power BI Query failed: {response.status_code}")
            
            data = response.json()
            try:
                return data['results'][0]['tables'][0]['rows']
            except (KeyError, IndexError):
                return []

    @staticmethod
    async def introspect_schema(workspace_id: str, dataset_id: str, token: str) -> Dict[str, Any]:
        """Discovers tables and columns using DAX INFO functions."""
        # 1. Fetch Tables
        tables_dax = "EVALUATE INFO.TABLES()"
        tables_rows = await PowerBIService.execute_query(workspace_id, dataset_id, tables_dax, token)
        
        # 2. Fetch Columns
        columns_dax = """
        EVALUATE 
        SELECTCOLUMNS(
            INFO.COLUMNS(),
            "TableID", [TableID],
            "ColumnName", [Name],
            "DataType", [DataType],
            "IsHidden", [IsHidden]
        )
        """
        columns_rows = await PowerBIService.execute_query(workspace_id, dataset_id, columns_dax, token)
        
        table_id_map = {row['ID']: row['Name'] for row in tables_rows if 'ID' in row and 'Name' in row}
        
        schema = {}
        for col in columns_rows:
            t_id = col.get('TableID')
            t_name = table_id_map.get(t_id)
            if not t_name: continue
            
            if t_name not in schema:
                schema[t_name] = []
            
            schema[t_name].append({
                "name": col.get('ColumnName'),
                "type": col.get('DataType', 'string'),
                "hidden": col.get('IsHidden', False)
            })
            
        return schema
