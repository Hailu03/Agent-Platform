from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.models.base import get_db
from app.models.user import User
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate, WorkflowResponse, WorkflowRunRequest
from app.core.security import get_current_user
from app.repositories.workflow_repo import WorkflowRepository
from app.services.workflow_service import WorkflowService
from app.agents.workflow_executor import WorkflowExecutor
import time

router = APIRouter(prefix="/workflows", tags=["Workflows"])

def get_workflow_service(db: AsyncSession = Depends(get_db)) -> WorkflowService:
    repo = WorkflowRepository(db)
    return WorkflowService(repo)

@router.post("/{workflow_id}/run")
async def run_workflow_dry_run(
    workflow_id: str,
    run_req: WorkflowRunRequest,
    db: AsyncSession = Depends(get_db),
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    """
    Thực hiện chạy thử (Dry Run) một quy trình workflow LangGraph.
    Trả về lịch trình thực thi chi tiết (Execution Trace) của từng node.
    """
    workflow = await service.get_workflow(workflow_id, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình")

    # 1. Tìm cấu hình Agent phù hợp
    agent_config = {}
    from app.repositories.agent_repo import AgentRepository
    agent_repo = AgentRepository(db)

    if run_req.agent_id:
        agent = await agent_repo.get_by_id(run_req.agent_id, current_user.id)
        if agent:
            agent_config = {
                "id": agent.id,
                "model_provider": agent.model_provider,
                "model_name": agent.model_name,
                "api_key": agent.api_key,
                "embedding_provider": agent.embedding_provider,
                "embedding_model": agent.embedding_model,
                "embedding_api_key": agent.embedding_api_key
            }
    
    if not agent_config:
        # Tự động chọn agent đầu tiên của user để dễ test
        agents = await agent_repo.list_by_user(current_user.id)
        if agents:
            agent = agents[0]
            agent_config = {
                "id": agent.id,
                "model_provider": agent.model_provider,
                "model_name": agent.model_name,
                "api_key": agent.api_key,
                "embedding_provider": agent.embedding_provider,
                "embedding_model": agent.embedding_model,
                "embedding_api_key": agent.embedding_api_key
            }
            
    if not agent_config:
        # Fallback an toàn nếu chưa có Agent nào
        agent_config = {
            "id": "mock_agent",
            "model_provider": "google",
            "model_name": "gemini-2.5-flash",
            "api_key": None
        }

    # 2. Biên dịch workflow sang LangGraph StateGraph
    graph_data = workflow.graph
    if isinstance(graph_data, str):
        import json
        graph_data = json.loads(graph_data)

    try:
        executor = WorkflowExecutor(graph_data, agent_config)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi biên dịch Workflow Graph: {str(e)}")

    # 3. Chuẩn bị initial state
    initial_state = {
        "messages": [("user", run_req.user_query)],
        "variable_pool": {},
        "current_node": "",
        "final_answer": "",
        "thread_id": f"dryrun_{workflow_id}_{int(time.time())}"
    }

    # Đưa các mock inputs vào pool bắt đầu
    if run_req.inputs:
        initial_state["variable_pool"]["start"] = run_req.inputs

    # 4. Thực thi và thu thập vết (Trace Telemetry)
    execution_history = []
    t_start = time.time()
    
    try:
        async for chunk in executor.app.astream(initial_state):
            for node_id, updates in chunk.items():
                node_detail = next((n for n in graph_data.get("nodes", []) if n["id"] == node_id), None)
                node_name = node_detail.get("data", {}).get("label") if node_detail else node_id
                node_type = node_detail.get("type") if node_detail else "unknown"
                
                # Trích xuất outputs của node vừa chạy từ pool
                pool = updates.get("variable_pool", {})
                node_outputs = pool.get(node_id, {})
                
                execution_history.append({
                    "node_id": node_id,
                    "node_name": node_name,
                    "node_type": node_type,
                    "outputs": node_outputs,
                    "timestamp": round((time.time() - t_start) * 1000, 1) # ms since start
                })
    except Exception as run_error:
        execution_history.append({
            "node_id": "error",
            "node_name": "Lỗi Thực Thi",
            "node_type": "error",
            "outputs": {"error": str(run_error)},
            "timestamp": round((time.time() - t_start) * 1000, 1)
        })

    return {
        "workflow_id": workflow_id,
        "success": not any(step["node_type"] == "error" for step in execution_history),
        "total_latency_ms": round((time.time() - t_start) * 1000, 1),
        "steps": execution_history
    }

@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow_in: WorkflowCreate,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    return await service.create_workflow(workflow_in, current_user.id)

@router.get("/", response_model=List[WorkflowResponse])
async def list_workflows(
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    return await service.list_workflows(current_user.id)

@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    workflow = await service.get_workflow(workflow_id, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình")
    return workflow

@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: str,
    workflow_in: WorkflowUpdate,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    workflow = await service.update_workflow(workflow_id, workflow_in, current_user.id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình để cập nhật")
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
    current_user: User = Depends(get_current_user)
):
    success = await service.delete_workflow(workflow_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình để xóa")
    return None
