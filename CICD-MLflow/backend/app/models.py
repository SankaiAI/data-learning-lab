"""
SQLAlchemy models for pipeline runs, steps, and deployment state.
"""

from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

Base = declarative_base()


class StepStatus(str, enum.Enum):
    """Status values for pipeline steps."""
    IDLE = "idle"
    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


class PipelineRun(Base):
    """Model for tracking pipeline runs."""
    __tablename__ = "pipeline_runs"

    id = Column(String(50), primary_key=True)
    commit_sha = Column(String(40), nullable=False)
    status = Column(String(20), default="pending")
    stage = Column(String(20), default="ci")  # ci, cd, deploy
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    mlflow_run_id = Column(String(50), nullable=True)
    mlflow_experiment_id = Column(String(50), nullable=True)
    metadata_json = Column(JSON, default=dict)

    # Relationships
    steps = relationship("PipelineStep", back_populates="pipeline_run", cascade="all, delete-orphan")


class PipelineStep(Base):
    """Model for individual pipeline steps."""
    __tablename__ = "pipeline_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(50), ForeignKey("pipeline_runs.id"), nullable=False)
    step_name = Column(String(100), nullable=False)
    status = Column(String(20), default=StepStatus.IDLE.value)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    logs = Column(Text, default="")
    outputs = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)

    # Relationships
    pipeline_run = relationship("PipelineRun", back_populates="steps")


class ModelRegistry(Base):
    """Model registry for tracking deployed models."""
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    stage = Column(String(20), default="none")  # none, staging, production, archived
    mlflow_run_id = Column(String(50), nullable=False)
    metrics = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    promoted_at = Column(DateTime, nullable=True)
    commit_sha = Column(String(40), nullable=True)
    is_champion = Column(Boolean, default=False)


class DeploymentState(Base):
    """Tracks current deployment state."""
    __tablename__ = "deployment_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    environment = Column(String(20), nullable=False)  # staging, production
    model_version = Column(String(50), nullable=False)
    mlflow_run_id = Column(String(50), nullable=False)
    deployed_at = Column(DateTime, default=datetime.utcnow)
    deployed_by = Column(String(100), default="system")
    status = Column(String(20), default="active")  # active, rollback, inactive


class ShadowTestResult(Base):
    """Results from shadow/A-B testing."""
    __tablename__ = "shadow_test_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_version = Column(String(50), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    sample_size = Column(Integer, nullable=False)
    metrics = Column(JSON, default=dict)
    drift_metrics = Column(JSON, default=dict)
    mlflow_run_id = Column(String(50), nullable=True)


# Pydantic models for API responses

class PipelineRunCreate(BaseModel):
    """Schema for creating a new pipeline run."""
    commit_sha: Optional[str] = None
    stage: str = "ci"


class PipelineRunResponse(BaseModel):
    """Schema for pipeline run responses."""
    id: str
    commit_sha: str
    status: str
    stage: str
    created_at: datetime
    mlflow_run_id: Optional[str]

    class Config:
        from_attributes = True


class StepResponse(BaseModel):
    """Schema for step responses."""
    step_name: str
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    outputs: Dict[str, Any]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class PipelineStatusResponse(BaseModel):
    """Complete pipeline status response."""
    run_id: str
    commit_sha: str
    status: str
    stage: str
    steps: List[StepResponse]
    mlflow_run_id: Optional[str]


class StepDefinition(BaseModel):
    """Definition of a pipeline step."""
    name: str
    display_name: str
    description: str
    stage: str  # ci, cd, deploy
    code_file: str
    config_file: str
    requires_approval: bool = False
    dependencies: List[str] = []


class ModelRegistryResponse(BaseModel):
    """Schema for model registry responses."""
    id: int
    model_name: str
    version: str
    stage: str
    mlflow_run_id: str
    metrics: Dict[str, Any]
    created_at: datetime
    is_champion: bool

    class Config:
        from_attributes = True
