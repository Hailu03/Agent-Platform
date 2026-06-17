import logging
import re
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class SemanticLayerService:
    """
    Semantic Data Agent service providing:
    - Table Allowlisting
    - Column Masking / Redaction
    - Read-only SQL query validation
    - Query audit logging
    """
    
    @staticmethod
    def is_readonly_query(sql_query: str) -> bool:
        """
        Verify if the generated SQL is read-only (blocks modifications like INSERT, UPDATE, DELETE, DROP).
        """
        clean_sql = re.sub(r'--.*$', '', sql_query, flags=re.MULTILINE) # Remove comments
        clean_sql = re.sub(r'/\*.*?\*/', '', clean_sql, flags=re.DOTALL)
        q_upper = clean_sql.upper().strip()
        
        # Block DDL and DML modifications
        blocked_keywords = [
            r"\bINSERT\b", r"\bUPDATE\b", r"\bDELETE\b", r"\bDROP\b", 
            r"\bALTER\b", r"\bTRUNCATE\b", r"\bCREATE\b", r"\bATTACH\b", 
            r"\bDETACH\b", r"\bGRANT\b", r"\bREVOKE\b"
        ]
        
        for pattern in blocked_keywords:
            if re.search(pattern, q_upper):
                return False
        return True

    @staticmethod
    def filter_schema_context(
        schema_context: str,
        allowlist: Optional[List[str]] = None,
        masking: Optional[List[str]] = None
    ) -> str:
        """
        Filters schema context text (from GraphRAG or schema dumps) to hide
        unauthorized tables and columns from the LLM.
        """
        if not allowlist and not masking:
            return schema_context
            
        lines = schema_context.split("\n")
        filtered_lines = []
        current_table = None
        
        # Lowercase for safe comparison
        allowlist_lower = [t.lower() for t in allowlist] if allowlist else None
        masking_lower = [c.lower() for c in masking] if masking else None
        
        for line in lines:
            line_strip = line.strip()
            
            # Detect table definitions
            # Examples: "Table: churn_data", "CREATE TABLE users (", etc.
            table_match = re.match(r'^(?:Table:\s*|CREATE\s+TABLE\s+)(["`\w]+)', line_strip, re.IGNORECASE)
            if table_match:
                current_table = table_match.group(1).replace('"', '').replace('`', '').strip().lower()
                
            if current_table:
                # 1. Filter Table Allowlist
                if allowlist_lower and current_table not in allowlist_lower:
                    continue # Skip this line
                    
                # 2. Filter Column Masking
                # Examples: "- column_name (type)", "column_name type,"
                if masking_lower:
                    is_masked = False
                    for mask_col in masking_lower:
                        # Match line containing column name
                        col_pattern = rf'(?:^|[\s\-\"`\',]){re.escape(mask_col)}(?:$|[\s\-\"`\',:\(\);])'
                        if re.search(col_pattern, line_strip.lower()):
                            is_masked = True
                            break
                    if is_masked:
                        continue # Skip masked column line
                        
            filtered_lines.append(line)
            
        return "\n".join(filtered_lines)

    @staticmethod
    def apply_masking_to_results(
        rows: List[Dict[str, Any]],
        masking: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Redacts highly sensitive column fields in final query result rows with [REDACTED].
        """
        if not rows or not masking:
            return rows
            
        masking_lower = [c.lower() for c in masking]
        redacted_rows = []
        
        for row in rows:
            new_row = {}
            for k, v in row.items():
                if k.lower() in masking_lower:
                    new_row[k] = "[REDACTED]"
                else:
                    new_row[k] = v
            redacted_rows.append(new_row)
            
        return redacted_rows

    @staticmethod
    def log_query(
        agent_id: str,
        user_id: str,
        sql_query: str,
        status: str,
        row_count: int = 0,
        error_message: Optional[str] = None
    ) -> None:
        """
        Logs the generated SQL queries, execution status, and audit parameters.
        Writes to backend logger and audit directory.
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "agent_id": agent_id,
            "user_id": user_id,
            "sql_query": sql_query,
            "status": status,
            "row_count": row_count,
            "error": error_message
        }
        
        # 1. Standard logs
        if status == "success":
            logger.info(f"📊 [SQL AUDIT SUCCESS] Agent {agent_id} executed query returning {row_count} rows.")
        else:
            logger.warning(f"⚠️ [SQL AUDIT FAILED] Agent {agent_id} failed query: {error_message}")
            
        # 2. File-based audit logs for long-term storage
        try:
            audit_dir = r"d:\Users\haib1\OneDrive\documents\work\WAO\cms_agent\backend\logs\sql_audit"
            os.makedirs(audit_dir, exist_ok=True)
            log_file = os.path.join(audit_dir, f"audit_{datetime.utcnow().strftime('%Y-%m-%d')}.jsonl")
            
            import json
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to write SQL audit file: {e}")
