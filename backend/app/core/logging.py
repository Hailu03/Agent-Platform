import logging
import sys
from typing import Any

# Định dạng log: Thời gian - Tên Logger - Cấp độ - Tin nhắn
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

def setup_logging():
    """
    Cấu hình hệ thống logging cho toàn bộ ứng dụng.
    """
    # Cấu hình cơ bản
    logging.basicConfig(
        level=logging.INFO,
        format=LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    # Có thể tùy chỉnh cấp độ cho các thư viện cụ thể nếu quá ồn ào
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    """
    Hàm tiện ích để lấy một logger với tên cụ thể.
    """
    return logging.getLogger(name)
