import asyncio
from datetime import datetime
import pytz
from sqlalchemy import select
from app.models.base import AsyncSessionLocal
from app.models.workflow import Workflow
from app.routers.workflow import run_workflow_background
from app.core.logging import get_logger

logger = get_logger("workflow_scheduler", log_file="logs/workflow_scheduler.log")

def cron_matches(cron_expr: str, dt: datetime) -> bool:
    """
    Checks if a datetime matches a standard 5-field cron expression.
    Supported formats per field:
      - '*': any value
      - '*/N': steps (e.g. '*/5' for every 5 units)
      - 'A,B,C': lists (e.g. '1,2,3')
      - 'A-B': ranges (e.g. '1-5')
      - 'N': exact value
    """
    def match_field(field: str, val: int, min_val: int, max_val: int) -> bool:
        if field == '*':
            return True
        if ',' in field:
            return any(match_field(f, val, min_val, max_val) for f in field.split(','))
        if '/' in field:
            base, step = field.split('/', 1)
            try:
                step_val = int(step)
                if base == '*':
                    return (val - min_val) % step_val == 0
                else:
                    start = int(base)
                    return val >= start and (val - start) % step_val == 0
            except ValueError:
                return False
        if '-' in field:
            try:
                start, end = field.split('-', 1)
                return int(start) <= val <= int(end)
            except ValueError:
                return False
        try:
            return int(field) == val
        except ValueError:
            return False

    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return False
            
        m, h, dom, mon, dow = parts
        
        # Check minute (0-59)
        if not match_field(m, dt.minute, 0, 59):
            return False
        # Check hour (0-23)
        if not match_field(h, dt.hour, 0, 23):
            return False
        # Check day of month (1-31)
        if not match_field(dom, dt.day, 1, 31):
            return False
        # Check month (1-12)
        if not match_field(mon, dt.month, 1, 12):
            return False
            
        # Check day of week (0-6, where Sunday is 0 or 7)
        # Python weekday() is Monday=0, Sunday=6.
        # Standard cron: Sunday=0 or 7, Monday=1, ..., Saturday=6.
        cron_dow = dt.weekday() + 1
        if cron_dow == 7: # Sunday
            if match_field(dow, 0, 0, 7) or match_field(dow, 7, 0, 7):
                return True
            return False
            
        if not match_field(dow, cron_dow, 0, 7):
            return False
            
        return True
    except Exception as e:
        logger.error(f"⚠️ Error evaluating cron expression '{cron_expr}': {e}")
        return False

async def workflow_cron_scheduler_loop():
    """
    Vòng lặp chạy nền quét toàn bộ Workflow mỗi phút một lần
    để thực thi các quy trình định kỳ có cấu hình cronjob.
    """
    logger.info("⏰ Khởi động vòng lặp lập lịch Workflow Cronjob...")
    
    # Định dạng múi giờ Việt Nam
    tz = pytz.timezone("Asia/Ho_Chi_Minh")
    
    while True:
        try:
            # Chờ đến đầu phút tiếp theo để quét chính xác hơn
            now = datetime.now(tz)
            seconds_to_wait = 60 - now.second
            # Thêm một chút buffer nhỏ (0.5 giây) để tránh trùng lặp phút cũ
            await asyncio.sleep(seconds_to_wait + 0.5)
            
            current_time = datetime.now(tz)
            logger.info(f"🔍 Quét lịch chạy định kỳ tại thời điểm: {current_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            async with AsyncSessionLocal() as session:
                # Quét tất cả các active workflow có cấu hình cron và is_scheduled=True
                result = await session.execute(
                    select(Workflow).where(
                        Workflow.is_active == True,
                        Workflow.is_scheduled == True,
                        Workflow.cron_expression.isnot(None),
                        Workflow.cron_expression != ""
                    )
                )
                scheduled_workflows = result.scalars().all()
                
                for wf in scheduled_workflows:
                    if cron_matches(wf.cron_expression, current_time):
                        logger.info(f"⚡ [Cron Trigger] Kích hoạt Workflow '{wf.name}' (ID: {wf.id}) theo lịch '{wf.cron_expression}'")
                        
                        # Chạy nền trong isolated database session để tránh xung đột session
                        async def run_in_bg_with_session(w_id=wf.id):
                            try:
                                async with AsyncSessionLocal() as bg_session:
                                    res = await bg_session.execute(select(Workflow).where(Workflow.id == w_id))
                                    wf_fresh = res.scalar_one_or_none()
                                    if wf_fresh:
                                        payload = {
                                            "trigger_source": "cronjob",
                                            "scheduled_time": current_time.isoformat(),
                                            "cron_expression": wf_fresh.cron_expression
                                        }
                                        await run_workflow_background(wf_fresh, payload, bg_session)
                            except Exception as run_err:
                                logger.error(f"❌ Lỗi chạy nền cho workflow {w_id}: {run_err}")
                        
                        asyncio.create_task(run_in_bg_with_session())
                        
        except asyncio.CancelledError:
            logger.info("🛑 Vòng lặp lập lịch Workflow Cronjob đã bị dừng.")
            raise
        except Exception as e:
            logger.error(f"⚠️ Lỗi trong vòng lặp lập lịch Workflow: {e}")
            await asyncio.sleep(10)  # Chờ 10s trước khi thử lại nếu lỗi
