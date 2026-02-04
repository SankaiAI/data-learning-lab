"""
MLflow client wrapper for experiment tracking and model registry operations.
Provides a clean interface for logging runs, metrics, artifacts, and model versions.
"""

import mlflow
from mlflow.tracking import MlflowClient
from mlflow.entities import ViewType
from typing import Dict, List, Optional, Any
import logging
import os
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)


class MLflowClient:
    """
    Wrapper around MLflow client for experiment tracking and model registry.

    Handles experiment creation, run management, metric/artifact logging,
    and model registration/promotion.
    """

    def __init__(self):
        """Initialize the MLflow client with configured tracking URI."""
        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        self.client = MlflowClient()
        self.experiment_name = settings.experiment_name
        self.model_name = settings.model_name

        # Ensure experiment exists
        self._ensure_experiment()

    def _ensure_experiment(self):
        """Create the experiment if it doesn't exist."""
        experiment = mlflow.get_experiment_by_name(self.experiment_name)
        if experiment is None:
            experiment_id = mlflow.create_experiment(
                self.experiment_name,
                tags={"project": "claim-ml-cicd-lab"}
            )
            logger.info(f"Created experiment '{self.experiment_name}' with ID {experiment_id}")
        else:
            logger.info(f"Using existing experiment '{self.experiment_name}'")

    def start_run(
        self,
        run_name: str,
        commit_sha: str,
        stage: str,
        tags: Optional[Dict[str, str]] = None,
        nested: bool = False,
        parent_run_id: Optional[str] = None
    ) -> str:
        """
        Start a new MLflow run.

        Args:
            run_name: Name for the run
            commit_sha: Git commit SHA
            stage: Pipeline stage (ci/cd/deploy)
            tags: Additional tags to set
            nested: Whether this is a nested run
            parent_run_id: Parent run ID for nested runs

        Returns:
            The run ID
        """
        mlflow.set_experiment(self.experiment_name)

        # Prepare tags
        run_tags = {
            "commit_sha": commit_sha,
            "stage": stage,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if tags:
            run_tags.update(tags)

        # Start run
        if parent_run_id:
            run = mlflow.start_run(
                run_name=run_name,
                nested=True,
                tags=run_tags
            )
        else:
            run = mlflow.start_run(
                run_name=run_name,
                tags=run_tags
            )

        logger.info(f"Started MLflow run '{run_name}' with ID {run.info.run_id}")
        return run.info.run_id

    def end_run(self, status: str = "FINISHED"):
        """
        End the current active run.

        Args:
            status: Final status (FINISHED, FAILED, KILLED)
        """
        mlflow.end_run(status=status)

    def log_params(self, params: Dict[str, Any]):
        """
        Log parameters to the current run.

        Args:
            params: Dictionary of parameters to log
        """
        for key, value in params.items():
            mlflow.log_param(key, value)

    def log_metrics(self, metrics: Dict[str, float], step: Optional[int] = None):
        """
        Log metrics to the current run.

        Args:
            metrics: Dictionary of metrics to log
            step: Optional step number for tracking over time
        """
        mlflow.log_metrics(metrics, step=step)

    def log_artifact(self, local_path: str, artifact_path: Optional[str] = None):
        """
        Log an artifact file to the current run.

        Args:
            local_path: Path to the local file
            artifact_path: Optional subdirectory in artifacts
        """
        mlflow.log_artifact(local_path, artifact_path=artifact_path)

    def log_model(
        self,
        model,
        artifact_path: str,
        registered_name: Optional[str] = None,
        signature=None,
        input_example=None
    ):
        """
        Log a model to the current run.

        Args:
            model: The model object to log
            artifact_path: Path within artifacts to store the model
            registered_name: Optional name to register the model
            signature: Optional model signature
            input_example: Optional input example for signature inference
        """
        mlflow.sklearn.log_model(
            model,
            artifact_path,
            registered_model_name=registered_name,
            signature=signature,
            input_example=input_example
        )

    def get_run(self, run_id: str) -> dict:
        """
        Get details for a specific run.

        Args:
            run_id: The run ID to retrieve

        Returns:
            Dictionary with run details
        """
        run = self.client.get_run(run_id)
        return {
            "run_id": run.info.run_id,
            "run_name": run.info.run_name,
            "status": run.info.status,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
            "params": dict(run.data.params),
            "metrics": dict(run.data.metrics),
            "tags": dict(run.data.tags),
            "artifact_uri": run.info.artifact_uri
        }

    def list_runs(
        self,
        filter_string: Optional[str] = None,
        max_results: int = 100,
        order_by: List[str] = None
    ) -> List[dict]:
        """
        List runs matching the filter criteria.

        Args:
            filter_string: MLflow filter string
            max_results: Maximum number of runs to return
            order_by: List of columns to order by

        Returns:
            List of run dictionaries
        """
        experiment = mlflow.get_experiment_by_name(self.experiment_name)
        if not experiment:
            return []

        runs = self.client.search_runs(
            experiment_ids=[experiment.experiment_id],
            filter_string=filter_string or "",
            max_results=max_results,
            order_by=order_by or ["start_time DESC"]
        )

        return [
            {
                "run_id": run.info.run_id,
                "run_name": run.info.run_name,
                "status": run.info.status,
                "start_time": run.info.start_time,
                "end_time": run.info.end_time,
                "params": dict(run.data.params),
                "metrics": dict(run.data.metrics),
                "tags": dict(run.data.tags),
            }
            for run in runs
        ]

    def list_artifacts(self, run_id: str, path: str = "") -> List[dict]:
        """
        List artifacts for a run.

        Args:
            run_id: The run ID
            path: Optional path within artifacts

        Returns:
            List of artifact info dictionaries
        """
        artifacts = self.client.list_artifacts(run_id, path)
        return [
            {
                "path": a.path,
                "is_dir": a.is_dir,
                "file_size": a.file_size
            }
            for a in artifacts
        ]

    def get_artifact_uri(self, run_id: str, artifact_path: str) -> str:
        """
        Get the URI for an artifact.

        Args:
            run_id: The run ID
            artifact_path: Path to the artifact

        Returns:
            URI string for the artifact
        """
        run = self.client.get_run(run_id)
        return f"{run.info.artifact_uri}/{artifact_path}"

    def register_model(self, run_id: str, model_path: str, name: str = None) -> str:
        """
        Register a model from a run.

        Args:
            run_id: The run ID containing the model
            model_path: Path to the model within artifacts
            name: Model name in registry

        Returns:
            Model version string
        """
        model_uri = f"runs:/{run_id}/{model_path}"
        name = name or self.model_name

        result = mlflow.register_model(model_uri, name)
        return result.version

    def transition_model_stage(
        self,
        name: str,
        version: str,
        stage: str,
        archive_existing: bool = True
    ):
        """
        Transition a model version to a new stage.

        Args:
            name: Model name
            version: Model version
            stage: Target stage (Staging, Production, Archived)
            archive_existing: Whether to archive existing models in target stage
        """
        self.client.transition_model_version_stage(
            name=name or self.model_name,
            version=version,
            stage=stage,
            archive_existing_versions=archive_existing
        )

    def get_latest_model_version(
        self,
        name: str = None,
        stages: List[str] = None
    ) -> Optional[dict]:
        """
        Get the latest model version for given stages.

        Args:
            name: Model name
            stages: List of stages to check

        Returns:
            Model version info or None
        """
        try:
            name = name or self.model_name
            stages = stages or ["Production", "Staging", "None"]

            versions = self.client.get_latest_versions(name, stages=stages)

            if versions:
                v = versions[0]
                return {
                    "name": v.name,
                    "version": v.version,
                    "stage": v.current_stage,
                    "run_id": v.run_id,
                    "status": v.status,
                    "creation_timestamp": v.creation_timestamp
                }
        except Exception as e:
            logger.warning(f"Could not get latest model version: {e}")

        return None

    def get_champion_model(self) -> Optional[dict]:
        """
        Get the current champion (production) model.

        Returns:
            Model version info or None
        """
        return self.get_latest_model_version(stages=["Production"])

    def load_model(self, model_uri: str):
        """
        Load a model from MLflow.

        Args:
            model_uri: URI to the model (e.g., models:/name/Production)

        Returns:
            The loaded model
        """
        return mlflow.sklearn.load_model(model_uri)

    def compare_models(
        self,
        challenger_run_id: str,
        champion_run_id: str,
        metric_name: str = "f1_score"
    ) -> dict:
        """
        Compare challenger and champion models.

        Args:
            challenger_run_id: Run ID of challenger model
            champion_run_id: Run ID of champion model
            metric_name: Metric to compare

        Returns:
            Comparison results dictionary
        """
        challenger = self.get_run(challenger_run_id)
        champion = self.get_run(champion_run_id)

        challenger_metric = challenger["metrics"].get(metric_name, 0)
        champion_metric = champion["metrics"].get(metric_name, 0)

        improvement = challenger_metric - champion_metric
        improvement_pct = (improvement / champion_metric * 100) if champion_metric else 0

        return {
            "challenger": {
                "run_id": challenger_run_id,
                "metric": challenger_metric
            },
            "champion": {
                "run_id": champion_run_id,
                "metric": champion_metric
            },
            "metric_name": metric_name,
            "improvement": improvement,
            "improvement_pct": improvement_pct,
            "challenger_wins": challenger_metric > champion_metric
        }
