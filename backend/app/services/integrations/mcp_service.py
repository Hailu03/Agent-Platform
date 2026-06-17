import json
import httpx
from typing import List, Dict, Any, Optional
from app.models.mcp import MCPServer
from app.core.logging import get_logger

logger = get_logger(__name__)

class MCPClientService:
    def __init__(self):
        pass

    @classmethod
    def _build_headers(cls, auth_type: str, auth_config: Dict[str, Any]) -> Dict[str, str]:
        """
        Xây dựng headers xác thực dựa trên auth_type và auth_config
        """
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        if not auth_type or auth_type == "none":
            return headers
            
        if auth_type == "bearer_token":
            token = auth_config.get("token") or auth_config.get("value")
            if token:
                headers["Authorization"] = f"Bearer {token}"
                
        elif auth_type == "api_key":
            header_name = auth_config.get("header_name") or "X-API-Key"
            api_key = auth_config.get("api_key") or auth_config.get("value")
            if api_key:
                headers[header_name] = api_key
                
        elif auth_type == "custom":
            headers_to_add = auth_config.get("headers") or auth_config
            if isinstance(headers_to_add, dict):
                for k, v in headers_to_add.items():
                    if k.lower() != "content-type" and k.lower() != "accept":
                        headers[k] = str(v)
                        
        return headers

    @classmethod
    async def fetch_tools_from_server(cls, server: MCPServer) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các công cụ được phơi bày từ máy chủ MCP Server bên ngoài.
        """
        headers = cls._build_headers(server.auth_type, server.auth_config or {})
        payload = {
            "jsonrpc": "2.0",
            "id": "list_tools",
            "method": "tools/list",
            "params": {}
        }
        
        logger.info(f"🔌 Kết nối máy chủ MCP: {server.name} ({server.url})")
        
        try:
            # 1. Thử trực tiếp qua HTTP POST (Phổ biến cho các API MCP gọn nhẹ)
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(server.url, json=payload, headers=headers)
                if response.status_code == 200:
                    result = response.json()
                    if "result" in result and "tools" in result["result"]:
                        return result["result"]["tools"]
                    elif "tools" in result:
                        return result["tools"]
                        
            # 2. Hỗ trợ cơ chế SSE (Server-Sent Events) nếu post trực tiếp không được hoặc trả về lỗi
            # Trình khách MCP Client sẽ kết nối GET để lấy luồng và tìm endpoint phụ để gửi POST
            logger.info(f"🔄 Đang thử kết nối SSE Handshake cho {server.name}...")
            async with httpx.AsyncClient(timeout=10.0) as client:
                async with client.stream("GET", server.url, headers=headers) as response:
                    # Đọc vài dòng đầu để tìm dòng 'event: endpoint'
                    # Chuẩn MCP SSE gửi luồng:
                    # event: endpoint
                    # data: /message?session_id=...
                    post_url = None
                    async for line in response.aiter_lines():
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str.startswith("http") or data_str.startswith("/"):
                                # Tìm thấy POST URL
                                if data_str.startswith("/"):
                                    # Kết hợp với base URL của server.url
                                    from urllib.parse import urljoin
                                    post_url = urljoin(server.url, data_str)
                                else:
                                    post_url = data_str
                                break
                        # Nếu đọc quá 20 dòng không tìm thấy thì break
                        if not line:
                            continue
                    
                    if post_url:
                        logger.info(f"🎯 Đã tìm thấy MCP SSE POST Endpoint: {post_url}")
                        post_resp = await client.post(post_url, json=payload, headers=headers)
                        if post_resp.status_code == 200:
                            result = post_resp.json()
                            if "result" in result and "tools" in result["result"]:
                                return result["result"]["tools"]
                            elif "tools" in result:
                                return result["tools"]
                                
            # 3. Fallback cuối cùng: Thử gửi GET request trực tiếp (một số mock servers)
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(server.url, headers=headers)
                if response.status_code == 200:
                    result = response.json()
                    if "tools" in result:
                        return result["tools"]
                    elif "result" in result and "tools" in result["result"]:
                        return result["result"]["tools"]
                        
            raise Exception(f"Máy chủ MCP không trả về kết quả hợp lệ (HTTP {response.status_code})")
        except Exception as e:
            logger.error(f"❌ Lỗi khi tải danh sách tool từ máy chủ MCP {server.name}: {e}")
            raise Exception(f"Không thể kết nối đến máy chủ MCP: {str(e)}")

    @classmethod
    async def call_tool_on_server(cls, server: MCPServer, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Gọi (thực thi) công cụ trên MCP Server từ xa qua JSON-RPC.
        """
        headers = cls._build_headers(server.auth_type, server.auth_config or {})
        payload = {
            "jsonrpc": "2.0",
            "id": f"call_{tool_name}",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        logger.info(f"🚀 Gọi công cụ MCP: {tool_name} trên server: {server.name}")
        
        try:
            # 1. Thử gửi POST trực tiếp trước
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(server.url, json=payload, headers=headers)
                if response.status_code == 200:
                    result = response.json()
                    if "result" in result:
                        return result["result"]
                    return result

            # 2. SSE Handshake Fallback
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("GET", server.url, headers=headers) as sse_resp:
                    post_url = None
                    async for line in sse_resp.aiter_lines():
                        if line.startswith("data:"):
                            data_str = line[5:].strip()
                            if data_str.startswith("http") or data_str.startswith("/"):
                                if data_str.startswith("/"):
                                    from urllib.parse import urljoin
                                    post_url = urljoin(server.url, data_str)
                                else:
                                    post_url = data_str
                                break
                    if post_url:
                        post_resp = await client.post(post_url, json=payload, headers=headers)
                        if post_resp.status_code == 200:
                            result = post_resp.json()
                            if "result" in result:
                                return result["result"]
                            return result
                            
            raise Exception(f"MCP Server phản hồi lỗi (HTTP {response.status_code})")
        except Exception as e:
            logger.error(f"❌ Lỗi khi thực thi công cụ MCP {tool_name}: {e}")
            raise Exception(f"Không thể thực thi công cụ MCP: {str(e)}")

    @classmethod
    async def test_connection(cls, url: str, auth_type: str, auth_config: Dict[str, Any]) -> bool:
        """
        Kiểm tra thử kết nối tới một MCP Server
        """
        headers = cls._build_headers(auth_type, auth_config)
        payload = {
            "jsonrpc": "2.0",
            "id": "ping",
            "method": "tools/list",
            "params": {}
        }
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Thử POST trực tiếp
                try:
                    response = await client.post(url, json=payload, headers=headers)
                    if response.status_code == 200:
                        return True
                except:
                    pass
                
                # Thử GET để xem có phải SSE hoặc static endpoint
                response = await client.get(url, headers=headers)
                if response.status_code in [200, 201]:
                    return True
                    
            return False
        except Exception as e:
            logger.warning(f"⚠️ Test connection failed for {url}: {e}")
            return False
