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

import os

def get_logger(name: str, log_file: str = None) -> logging.Logger:
    """
    Hàm tiện ích để lấy một logger với tên cụ thể.
    Có thể tùy chọn xuất ra file.
    """
    logger = logging.getLogger(name)
    
    if log_file:
        # Đảm bảo thư mục log tồn tại
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        # Kiểm tra xem đã có FileHandler chưa để tránh lặp
        has_file_handler = any(isinstance(h, logging.FileHandler) and h.baseFilename == os.path.abspath(log_file) for h in logger.handlers)
        
        if not has_file_handler:
            file_handler = logging.FileHandler(log_file, encoding='utf-8')
            file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
            logger.addHandler(file_handler)
            
    return logger
