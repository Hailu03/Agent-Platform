import boto3
from botocore.exceptions import ClientError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
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
        except ClientError:
            self.s3.create_bucket(Bucket=self.bucket_name)
            logger.info(f"Created bucket {self.bucket_name}")

    def upload_file(self, file_data, object_name):
        try:
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

storage_service = StorageService()
