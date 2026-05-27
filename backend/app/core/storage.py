import boto3
from botocore.exceptions import ClientError, EndpointConnectionError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.available = False
        self.s3 = boto3.client(
            's3',
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}" if not settings.MINIO_SECURE else f"https://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=boto3.session.Config(signature_version='s3v4')
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.s3.head_bucket(Bucket=self.bucket_name)
            self.available = True
        except ClientError:
            try:
                self.s3.create_bucket(Bucket=self.bucket_name)
                self.available = True
                logger.info(f"Created bucket {self.bucket_name}")
            except Exception as e:
                self.available = False
                logger.warning(f"MinIO bucket setup skipped: {e}")
        except EndpointConnectionError as e:
            self.available = False
            logger.warning(f"MinIO is unavailable at {settings.MINIO_ENDPOINT}; file storage features are disabled: {e}")

    def _ensure_available(self):
        if not self.available:
            self._ensure_bucket()

        if not self.available:
            raise RuntimeError(
                f"File storage is unavailable. Start MinIO/S3 at {settings.MINIO_ENDPOINT} "
                "or update MINIO_ENDPOINT in backend/.env."
            )

    def upload_file(self, file_data, object_name):
        try:
            self._ensure_available()
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_data
            )
            return f"{settings.MINIO_ENDPOINT}/{self.bucket_name}/{object_name}"
        except Exception as e:
            logger.error(f"Error uploading file to MinIO: {e}")
            raise e

    def get_file(self, file_path_or_url: str) -> bytes:
        """
        Tải nội dung file từ MinIO. Hỗ trợ cả object_name hoặc full URL.
        """
        try:
            self._ensure_available()
            # Nếu là URL (chứa /bucket_name/), bóc tách lấy object_name
            object_name = file_path_or_url
            if f"/{self.bucket_name}/" in file_path_or_url:
                object_name = file_path_or_url.split(f"/{self.bucket_name}/")[1]
            
            response = self.s3.get_object(Bucket=self.bucket_name, Key=object_name)
            return response['Body'].read()
        except Exception as e:
            logger.error(f"Error getting file from MinIO: {e}")
            raise e

    def get_presigned_url(self, object_name, expires_in=3600, response_type=None, disposition='inline'):
        try:
            self._ensure_available()
            params = {
                'Bucket': self.bucket_name, 
                'Key': object_name,
                'ResponseContentDisposition': disposition
            }
            if response_type:
                params['ResponseContentType'] = response_type
                
            url = self.s3.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=expires_in
            )
            return url
        except Exception as e:
            logger.error(f"Error generating presigned URL: {e}")
            return None

    def delete_file(self, object_name):
        try:
            self._ensure_available()
            self.s3.delete_object(Bucket=self.bucket_name, Key=object_name)
        except Exception as e:
            logger.error(f"Error deleting file from MinIO: {e}")
            raise e

storage_service = StorageService()
