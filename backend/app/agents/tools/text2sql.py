import json
import logging
from typing import List, Dict, Any, Optional, Type
from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from sqlalchemy import select
from app.models.base import get_db
from app.models.datasource import DataSource
from app.services.duckdb_service import DuckDBService
from app.services.graph_rag_service import GraphRAGService
from app.core.security import decrypt_password

logger = logging.getLogger(__name__)

class Text2SQLInput(BaseModel):
    question: str = Field(description="Câu hỏi bằng ngôn ngữ tự nhiên về dữ liệu (ví dụ: 'Top 5 khách hàng có doanh thu cao nhất năm 2023 là ai?')")
    datasource_id: Optional[str] = Field(None, description="ID của nguồn dữ liệu cần truy vấn (có thể để trống nếu tool đã được cấu hình sẵn)")

class Text2SQLTool(BaseTool):
    name: str = "query_database"
    description: str = "Truy vấn dữ liệu từ cơ sở dữ liệu bằng ngôn ngữ tự nhiên. Sử dụng công cụ này khi người dùng yêu cầu báo cáo, thống kê hoặc xem dữ liệu từ database."
    args_schema: Type[BaseModel] = Text2SQLInput
    
    # Cấu hình agent (để lấy LLM và DataSource mặc định)
    agent_config: Optional[dict] = None
    
    # Các tham số có thể cấu hình
    max_rows: int = 100

    async def _arun(self, question: str, datasource_id: Optional[str] = None) -> str:
        # Ưu tiên datasource_id từ tham số, sau đó đến cấu hình tool trong agent
        ds_ids = [datasource_id] if datasource_id else []
        
        if not ds_ids and self.agent_config:
            # Tìm cấu hình của tool này trong agent.tools
            tools_config = self.agent_config.get("tools", [])
            for t in tools_config:
                if isinstance(t, dict) and t.get("name") == "text2sql":
                    config = t.get("config", {})
                    # Ưu tiên mảng datasource_ids (Multi-select), sau đó đến datasource_id (Single-select cũ)
                    ds_ids = config.get("datasource_ids") or ([config.get("datasource_id")] if config.get("datasource_id") else [])
                    break
        
        if not ds_ids:
            return "Lỗi: Không xác định được nguồn dữ liệu (DataSource IDs). Vui lòng cung cấp datasource_id hoặc cấu hình trong Agent."

        logger.info(f"📊 Text2SQL: Đang xử lý câu hỏi '{question}' cho {len(ds_ids)} datasources: {ds_ids}")
        
        # 1. Lấy thông tin chi tiết cho TẤT CẢ Datasources
        ds_configs = []
        async for db in get_db():
            try:
                result = await db.execute(select(DataSource).where(DataSource.id.in_(ds_ids)))
                data_sources = result.scalars().all()
                
                if not data_sources:
                    return f"Lỗi: Không tìm thấy bất kỳ nguồn dữ liệu nào trong danh sách: {ds_ids}"
                
                for ds in data_sources:
                    plain_pw = decrypt_password(ds.encrypted_password)
                    ds_configs.append({
                        "engine": ds.engine,
                        "name": ds.name,
                        "host": ds.host,
                        "port": ds.port,
                        "username": ds.username,
                        "plain_password": plain_pw,
                        "database": ds.database,
                        "schema_name": ds.schema_name,
                        "ssl": ds.ssl,
                    })
                
                # 2. Sử dụng GraphRAG để tìm ngữ cảnh Schema liên quan (Từ tất cả các nguồn)
                emb_config = {
                    "provider": self.agent_config.get("embedding_provider"),
                    "model": self.agent_config.get("embedding_model"),
                    "api_key": self.agent_config.get("embedding_api_key")
                } if self.agent_config else None
                
                graph_rag = GraphRAGService(
                    embedding_config=emb_config,
                    chat_api_key=self.agent_config.get("api_key") if self.agent_config else None,
                    chat_provider=self.agent_config.get("model_provider") if self.agent_config else None,
                    chat_model_name=self.agent_config.get("model_name") if self.agent_config else None,
                    agent_id=self.agent_config.get("id") if self.agent_config else None,
                    agent_name=self.agent_config.get("name") if self.agent_config else None,
                    collection_type="semantic"
                )
                
                # Tìm kiếm schema cho từng nguồn hoặc gộp chung
                ds_names_str = ", ".join([ds.name for ds in data_sources])
                schema_context = await graph_rag.query(f"Tìm cấu trúc bảng và cột liên quan đến: {question} trong các datasources: {ds_names_str}")
                
                # 3. Sử dụng LLM để sinh SQL
                llm = getattr(self, "llm", None)
                if not llm and self.agent_config:
                    from app.agents.factory import get_model
                    llm = get_model(
                        self.agent_config.get("model_provider"),
                        self.agent_config.get("model_name"),
                        api_key=self.agent_config.get("api_key")
                    )
                
                if not llm:
                    return "Lỗi: Không thể khởi tạo LLM để sinh SQL."

                # Xây dựng hướng dẫn tiền tố cho từng database (Khớp với logic alias của DuckDBService)
                prefix_instructions = "\n".join([
                    f"- Nếu truy cập database '{d['name']}', hãy dùng tiền tố: SELECT * FROM \"{d.get('name', 'db').replace(' ', '_').lower()}\".{d.get('schema_name') or 'public'}.tablename" 
                    for d in ds_configs
                ])

                sql_prompt = (
                    f"Bạn là một chuyên gia SQL đa nền tảng. Bạn có quyền truy cập vào các databases sau: {ds_names_str}.\n"
                    f"DATABASE ENGINES: {[d['engine'] for d in ds_configs]}\n"
                    f"SCHEMA CONTEXT (GraphRAG):\n{schema_context}\n\n"
                    f"CÂU HỎI: {question}\n\n"
                    f"YÊU CẦU QUAN TRỌNG:\n"
                    f"1. CHỈ TRẢ VỀ CÂU LỆNH SQL, không giải thích gì thêm.\n"
                    f"2. Bạn ĐƯỢC PHÉP thực hiện JOIN giữa các database khác nhau nếu cần thiết.\n"
                    f"3. LUÔN LUÔN sử dụng tên database làm tiền tố để tránh nhầm lẫn:\n{prefix_instructions}\n"
                    f"4. Luôn giới hạn kết quả trả về tối đa {self.max_rows} dòng.\n"
                )
                
                sql_response = await llm.ainvoke(sql_prompt)
                raw_content = sql_response.content
                
                # Xử lý trường hợp content là list (thường gặp với Google GenAI)
                if isinstance(raw_content, list):
                    sql_query = "".join([part.get("text", "") if isinstance(part, dict) else str(part) for part in raw_content])
                else:
                    sql_query = str(raw_content)
                
                sql_query = sql_query.strip()
                
                # Làm sạch markdown
                if "```sql" in sql_query:
                    sql_query = sql_query.split("```sql")[1].split("```")[0].strip()
                elif "```" in sql_query:
                    sql_query = sql_query.split("```")[1].split("```")[0].strip()
                
                logger.info(f"✨ SQL sinh ra (Multi-DB): {sql_query}")

                # 4. Thực thi SQL (DuckDB tự động quản lý các kết nối đã đăng ký trong context)
                with DuckDBService.execution_context(ds_configs) as conn:
                    rows = DuckDBService.execute_query(conn, sql_query)
                    
                if not rows:
                    return f"Truy vấn thành công nhưng không có dữ liệu trả về cho câu hỏi: '{question}'.\nSQL đã thực thi: {sql_query}"
                
                # Trả về kết quả thô để LLM tự trình bày lại (định dạng này giúp LLM dễ đọc hơn JSON thô)
                return {
                    "status": "success",
                    "row_count": len(rows),
                    "data": rows,
                    "executed_sql": sql_query
                }

            except Exception as e:
                logger.error(f"❌ Lỗi Text2SQL: {e}")
                return f"Lỗi khi thực hiện truy vấn dữ liệu: {str(e)}"
            finally:
                await db.close()

    def _run(self, question: str, datasource_id: Optional[str] = None):
        raise NotImplementedError("Sử dụng _arun")

