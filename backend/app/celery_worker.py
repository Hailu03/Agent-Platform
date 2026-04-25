from celery import Celery
from app.core.config import settings

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
# import app.tasks.embedding
# import app.tasks.agent_run
# import app.tasks.indexing
