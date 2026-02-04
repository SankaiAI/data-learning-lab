"""
Configuration settings for the Claim ML CI/CD Lab backend.
Uses pydantic-settings for environment variable management.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MLflow Configuration
    mlflow_tracking_uri: str = "http://mlflow:5000"
    mlflow_s3_endpoint_url: str = "http://minio:9000"
    aws_access_key_id: str = "minioadmin"
    aws_secret_access_key: str = "minioadmin123"

    # Database Configuration
    database_url: str = "postgresql://mlflow:mlflow123@postgres:5432/mlflow"

    # Application Configuration
    secret_key: str = "dev-secret-key-change-in-production"
    debug: bool = True

    # ML Configuration
    experiment_name: str = "claim-settlement-prediction"
    model_name: str = "claim-settlement-model"

    # Data Configuration
    data_dir: str = "/app/data"
    ml_scripts_dir: str = "/app/ml"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()


# Set MLflow environment variables
os.environ["MLFLOW_TRACKING_URI"] = settings.mlflow_tracking_uri
os.environ["MLFLOW_S3_ENDPOINT_URL"] = settings.mlflow_s3_endpoint_url
os.environ["AWS_ACCESS_KEY_ID"] = settings.aws_access_key_id
os.environ["AWS_SECRET_ACCESS_KEY"] = settings.aws_secret_access_key
