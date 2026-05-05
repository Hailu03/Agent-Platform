import duckdb
import logging
import pandas as pd
from typing import Any, List, Dict, Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

class DuckDBService:
    @staticmethod
    def get_connection():
        """Returns a memory-resident DuckDB connection."""
        return duckdb.connect(database=':memory:')

    @staticmethod
    def load_extensions(conn: duckdb.DuckDBPyConnection, engines: List[str]):
        """Load necessary extensions for the given engines."""
        for engine in set(engines):
            if engine in ["postgres", "postgresql"]:
                try:
                    conn.execute("INSTALL postgres; LOAD postgres;")
                except Exception as e:
                    logger.error(f"Failed to load postgres extension: {e}")
            elif engine == "mysql":
                try:
                    conn.execute("INSTALL mysql; LOAD mysql;")
                except Exception as e:
                    logger.error(f"Failed to load mysql extension: {e}")
            elif engine == "sqlite":
                try:
                    conn.execute("INSTALL sqlite; LOAD sqlite;")
                except Exception as e:
                    logger.error(f"Failed to load sqlite extension: {e}")

    @staticmethod
    @contextmanager
    def execution_context(datasources: List[Dict[str, Any]], workspace_files: List[Any] = None):
        """
        A context manager that:
        1. Creates a memory DuckDB connection.
        2. Attaches all datasources and local files.
        3. Yields the connection.
        """
        conn = duckdb.connect(database=':memory:')
        
        try:
            # 1. Load extensions based on datasource engines
            engines = [ds.get("engine") for ds in datasources if ds.get("engine")]
            DuckDBService.load_extensions(conn, engines)
            
            # 2. Attach remote datasources
            for ds in datasources:
                engine = ds.get("engine")
                if not engine: continue
                
                alias = ds.get("name", "db").replace(" ", "_").lower()
                host = ds.get("host")
                port = ds.get("port")
                user = ds.get("username")
                password = ds.get("plain_password", "")
                database = ds.get("database")
                ssl = ds.get("ssl", False)
                
                if engine in ["postgres", "postgresql"]:
                    conn_str = f"dbname={database} user={user} password={password} host={host} port={port}"
                    if ssl:
                         conn_str += " sslmode=require"
                    else:
                         conn_str += " sslmode=disable"
                    conn.execute(f"ATTACH '{conn_str}' AS \"{alias}\" (TYPE POSTGRES);")
                    
                elif engine == "mysql":
                    conn_str = f"host={host} user={user} password={password} database={database} port={port}"
                    conn.execute(f"ATTACH '{conn_str}' AS \"{alias}\" (TYPE MYSQL);")
                
                elif engine == "sqlite":
                    conn.execute(f"ATTACH '{database}' AS \"{alias}\" (TYPE SQLITE);")

            # 3. Attach local files (if any)
            if workspace_files:
                conn.execute("CREATE SCHEMA IF NOT EXISTS public;")
                for f in workspace_files:
                    table_name = getattr(f, 'table_name', 'data')
                    file_path = getattr(f, 'file_path', '')
                    file_type = getattr(f, 'file_type', 'csv')
                    
                    if file_type in ["csv", "gsheet"]:
                        conn.execute(f"CREATE OR REPLACE VIEW public.\"{table_name}\" AS SELECT * FROM read_csv_auto('{file_path}')")
                    elif file_type == "parquet":
                        conn.execute(f"CREATE OR REPLACE VIEW public.\"{table_name}\" AS SELECT * FROM read_parquet('{file_path}')")

                conn.execute("SET search_path = 'public,main,pg_catalog';")

            yield conn
            
        except Exception as e:
            logger.error(f"DuckDB context error: {e}")
            raise
        finally:
            try:
                conn.close()
            except:
                pass

    @staticmethod
    def execute_query(conn: duckdb.DuckDBPyConnection, query: str) -> List[Dict[str, Any]]:
        """Execute a query and return results as a list of dicts."""
        try:
            df = conn.execute(query).fetch_df()
            # Convert NaN to None for JSON
            df = df.where(pd.notnull(df), None)
            return df.to_dict(orient='records')
        except Exception as e:
            logger.error(f"Execution error: {e}")
            raise
