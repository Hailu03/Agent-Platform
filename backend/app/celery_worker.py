from celery import Celery
from app.core.config import settings
from app.core.logging import setup_logging
from celery.signals import worker_process_init

@worker_process_init.connect
def configure_workers(sender=None, **kwargs):
    setup_logging()
    print("✅ Celery worker logging initialized.")

celery_app = Celery(
    "wao_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
)

# Import tasks explicitly so Celery can discover them
import app.tasks.graph_rag
