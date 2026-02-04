"""
Pipeline step definitions and executor.
Defines all CI/CD steps and their execution logic.
"""

import asyncio
import os
import sys
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
import importlib.util

from app.websocket_manager import WebSocketManager
from app.config import settings

logger = logging.getLogger(__name__)

# Step definitions - describes each pipeline step
STEP_DEFINITIONS = [
    {
        "name": "commit_received",
        "display_name": "Commit/PR Received",
        "description": "New commit or PR triggers the pipeline",
        "stage": "ci",
        "code_file": "ml/training/commit_handler.py",
        "config_file": "configs/commit.yaml",
        "requires_approval": False,
        "dependencies": []
    },
    {
        "name": "ci_tests",
        "display_name": "CI Tests",
        "description": "Run unit tests and linting",
        "stage": "ci",
        "code_file": "ml/validation/ci_tests.py",
        "config_file": "configs/ci_tests.yaml",
        "requires_approval": False,
        "dependencies": ["commit_received"]
    },
    {
        "name": "data_validation",
        "display_name": "Data Validation",
        "description": "Validate data schema and quality",
        "stage": "ci",
        "code_file": "ml/validation/data_validation.py",
        "config_file": "configs/data_validation.yaml",
        "requires_approval": False,
        "dependencies": ["ci_tests"]
    },
    {
        "name": "ci_quick_train",
        "display_name": "CI Quick Train",
        "description": "Fast training on sample data for validation",
        "stage": "ci",
        "code_file": "ml/training/quick_train.py",
        "config_file": "configs/quick_train.yaml",
        "requires_approval": False,
        "dependencies": ["data_validation"]
    },
    {
        "name": "mlflow_log_ci",
        "display_name": "MLflow Log (CI)",
        "description": "Log CI results to MLflow",
        "stage": "ci",
        "code_file": "ml/training/mlflow_logger.py",
        "config_file": "configs/mlflow.yaml",
        "requires_approval": False,
        "dependencies": ["ci_quick_train"]
    },
    {
        "name": "cd_full_train",
        "display_name": "CD Full Train",
        "description": "Full model training on complete dataset",
        "stage": "cd",
        "code_file": "ml/training/full_train.py",
        "config_file": "configs/full_train.yaml",
        "requires_approval": False,
        "dependencies": ["mlflow_log_ci"]
    },
    {
        "name": "evaluate_vs_champion",
        "display_name": "Evaluate vs Champion",
        "description": "Compare challenger model against current champion",
        "stage": "cd",
        "code_file": "ml/validation/evaluate_champion.py",
        "config_file": "configs/evaluation.yaml",
        "requires_approval": False,
        "dependencies": ["cd_full_train"]
    },
    {
        "name": "manual_approval",
        "display_name": "Manual Approval",
        "description": "Wait for human approval to proceed to deployment",
        "stage": "cd",
        "code_file": "ml/training/approval_gate.py",
        "config_file": "configs/approval.yaml",
        "requires_approval": True,
        "dependencies": ["evaluate_vs_champion"]
    },
    {
        "name": "deploy_staging",
        "display_name": "Deploy to Staging",
        "description": "Deploy model to staging environment",
        "stage": "deploy",
        "code_file": "ml/training/deploy.py",
        "config_file": "configs/deploy_staging.yaml",
        "requires_approval": False,
        "dependencies": ["manual_approval"]
    },
    {
        "name": "shadow_monitor",
        "display_name": "Shadow/A-B Monitor",
        "description": "Run shadow scoring and monitor drift",
        "stage": "deploy",
        "code_file": "ml/validation/shadow_monitor.py",
        "config_file": "configs/shadow_monitor.yaml",
        "requires_approval": False,
        "dependencies": ["deploy_staging"]
    },
    {
        "name": "promote_prod",
        "display_name": "Promote to Production",
        "description": "Promote model to production",
        "stage": "deploy",
        "code_file": "ml/training/promote_prod.py",
        "config_file": "configs/deploy_prod.yaml",
        "requires_approval": False,
        "dependencies": ["shadow_monitor"]
    },
    {
        "name": "rollback",
        "display_name": "Rollback",
        "description": "Rollback to previous production model",
        "stage": "deploy",
        "code_file": "ml/training/rollback.py",
        "config_file": "configs/rollback.yaml",
        "requires_approval": False,
        "dependencies": []
    }
]


def get_step_definition(step_name: str) -> Optional[Dict[str, Any]]:
    """Get step definition by name."""
    for step in STEP_DEFINITIONS:
        if step["name"] == step_name:
            return step
    return None


class StepExecutor:
    """
    Executes individual pipeline steps.

    Each step runs its corresponding script and streams logs
    through WebSocket connections.
    """

    def __init__(self, ws_manager: WebSocketManager):
        """
        Initialize the step executor.

        Args:
            ws_manager: WebSocket manager for log streaming
        """
        self.ws_manager = ws_manager

        # Failure mode toggles (can be set via API)
        self.failure_modes = {
            "schema_validation": False,
            "metric_regression": False,
            "mlflow_connection": False,
            "training_error": False
        }

    def set_failure_mode(self, mode: str, enabled: bool):
        """Enable/disable a failure mode for testing."""
        if mode in self.failure_modes:
            self.failure_modes[mode] = enabled
            logger.info(f"Failure mode '{mode}' set to {enabled}")

    async def execute(
        self,
        step_name: str,
        run_id: str,
        commit_sha: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Execute a pipeline step.

        Args:
            step_name: Name of the step to execute
            run_id: Pipeline run ID
            commit_sha: Git commit SHA
            db: Database session

        Returns:
            Step execution results
        """
        step_def = get_step_definition(step_name)
        if not step_def:
            raise ValueError(f"Unknown step: {step_name}")

        await self.ws_manager.send_log(
            run_id,
            f"Starting step: {step_def['display_name']}",
            "info"
        )

        # Execute step based on name
        executor_map = {
            "commit_received": self._execute_commit_received,
            "ci_tests": self._execute_ci_tests,
            "data_validation": self._execute_data_validation,
            "ci_quick_train": self._execute_ci_quick_train,
            "mlflow_log_ci": self._execute_mlflow_log_ci,
            "cd_full_train": self._execute_cd_full_train,
            "evaluate_vs_champion": self._execute_evaluate_champion,
            "manual_approval": self._execute_manual_approval,
            "deploy_staging": self._execute_deploy_staging,
            "shadow_monitor": self._execute_shadow_monitor,
            "promote_prod": self._execute_promote_prod,
            "rollback": self._execute_rollback
        }

        executor = executor_map.get(step_name)
        if not executor:
            raise ValueError(f"No executor for step: {step_name}")

        result = await executor(run_id, commit_sha, db)

        await self.ws_manager.send_log(
            run_id,
            f"Completed step: {step_def['display_name']}",
            "info"
        )

        return result

    async def _execute_commit_received(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Handle commit/PR received."""
        await self.ws_manager.send_log(run_id, f"Received commit: {commit_sha}", "info")
        await asyncio.sleep(0.5)  # Simulate processing

        return {
            "commit_sha": commit_sha,
            "timestamp": datetime.utcnow().isoformat(),
            "branch": "main"
        }

    async def _execute_ci_tests(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Run CI tests."""
        tests = [
            ("Unit tests", 15),
            ("Integration tests", 8),
            ("Linting", 3)
        ]

        passed = 0
        failed = 0

        for test_name, count in tests:
            await self.ws_manager.send_log(run_id, f"Running {test_name}...", "info")
            await asyncio.sleep(0.3)

            # Simulate test results
            test_passed = count
            test_failed = 0

            if self.failure_modes.get("training_error") and test_name == "Unit tests":
                test_failed = 2
                test_passed = count - 2

            passed += test_passed
            failed += test_failed

            await self.ws_manager.send_log(
                run_id,
                f"  {test_name}: {test_passed} passed, {test_failed} failed",
                "info" if test_failed == 0 else "warning"
            )

        if failed > 0 and self.failure_modes.get("training_error"):
            raise Exception(f"CI tests failed: {failed} tests failed")

        return {
            "tests_passed": passed,
            "tests_failed": failed,
            "coverage": 87.5
        }

    async def _execute_data_validation(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Validate data schema and quality."""
        await self.ws_manager.send_log(run_id, "Loading data schema...", "info")
        await asyncio.sleep(0.3)

        # Check failure mode
        if self.failure_modes.get("schema_validation"):
            await self.ws_manager.send_log(
                run_id,
                "ERROR: Schema validation failed - missing required column 'diagnosis_code'",
                "error"
            )
            raise Exception("Schema validation failed: missing required column 'diagnosis_code'")

        checks = [
            ("Schema validation", True),
            ("Null check", True),
            ("Range validation", True),
            ("Categorical validation", True)
        ]

        for check_name, passed in checks:
            await self.ws_manager.send_log(
                run_id,
                f"  {check_name}: {'PASSED' if passed else 'FAILED'}",
                "info" if passed else "error"
            )
            await asyncio.sleep(0.2)

        return {
            "schema_valid": True,
            "records_validated": 10000,
            "null_percentage": 0.02,
            "data_quality_score": 0.98
        }

    async def _execute_ci_quick_train(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Quick training on sample data."""
        await self.ws_manager.send_log(run_id, "Preparing sample dataset...", "info")
        await asyncio.sleep(0.3)

        await self.ws_manager.send_log(run_id, "Training on 1000 samples...", "info")

        # Simulate training progress
        for epoch in range(1, 4):
            await asyncio.sleep(0.5)
            loss = 0.5 / epoch
            await self.ws_manager.send_log(
                run_id,
                f"  Epoch {epoch}/3 - Loss: {loss:.4f}",
                "info"
            )

        metrics = {
            "accuracy": 0.85,
            "f1_score": 0.82,
            "auc_roc": 0.88,
            "training_time_seconds": 5.2
        }

        await self.ws_manager.send_metrics(run_id, metrics)

        return {
            "sample_size": 1000,
            "metrics": metrics,
            "model_type": "RandomForestClassifier"
        }

    async def _execute_mlflow_log_ci(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Log CI results to MLflow."""
        if self.failure_modes.get("mlflow_connection"):
            await self.ws_manager.send_log(
                run_id,
                "ERROR: Failed to connect to MLflow server",
                "error"
            )
            raise Exception("MLflow connection failed: Connection refused")

        await self.ws_manager.send_log(run_id, "Logging to MLflow...", "info")
        await asyncio.sleep(0.3)

        # Import MLflow functionality
        from app.mlflow_client import MLflowClient
        mlflow_client = MLflowClient()

        mlflow_run_id = mlflow_client.start_run(
            run_name=f"CI-{commit_sha[:8]}",
            commit_sha=commit_sha,
            stage="ci",
            tags={"pipeline_run_id": run_id}
        )

        # Log params and metrics
        mlflow_client.log_params({
            "model_type": "RandomForestClassifier",
            "sample_size": 1000,
            "seed": 42
        })

        mlflow_client.log_metrics({
            "ci_accuracy": 0.85,
            "ci_f1_score": 0.82,
            "ci_auc_roc": 0.88
        })

        mlflow_client.end_run()

        # Update pipeline run with MLflow run ID
        from app.models import PipelineRun
        pipeline = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if pipeline:
            pipeline.mlflow_run_id = mlflow_run_id
            db.commit()

        await self.ws_manager.send_log(
            run_id,
            f"Logged to MLflow run: {mlflow_run_id}",
            "info"
        )

        return {
            "mlflow_run_id": mlflow_run_id,
            "experiment_name": settings.experiment_name
        }

    async def _execute_cd_full_train(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Full model training."""
        await self.ws_manager.send_log(run_id, "Loading full training dataset...", "info")
        await asyncio.sleep(0.5)

        await self.ws_manager.send_log(run_id, "Training on 50000 samples...", "info")

        # Simulate training with progress
        for epoch in range(1, 11):
            await asyncio.sleep(0.3)

            # Calculate simulated metrics
            base_loss = 0.8
            loss = base_loss * (0.9 ** epoch) + 0.05

            if self.failure_modes.get("metric_regression"):
                # Simulate poor performance
                loss = 0.6
                accuracy = 0.65
            else:
                accuracy = 0.90 + (epoch * 0.005)

            await self.ws_manager.send_log(
                run_id,
                f"  Epoch {epoch}/10 - Loss: {loss:.4f}, Accuracy: {accuracy:.4f}",
                "info"
            )

        # Final metrics
        if self.failure_modes.get("metric_regression"):
            metrics = {
                "accuracy": 0.68,
                "f1_score": 0.65,
                "auc_roc": 0.70,
                "precision": 0.66,
                "recall": 0.64
            }
        else:
            metrics = {
                "accuracy": 0.92,
                "f1_score": 0.89,
                "auc_roc": 0.94,
                "precision": 0.90,
                "recall": 0.88
            }

        await self.ws_manager.send_metrics(run_id, metrics)

        # Log to MLflow
        from app.mlflow_client import MLflowClient
        mlflow_client = MLflowClient()

        mlflow_run_id = mlflow_client.start_run(
            run_name=f"CD-{commit_sha[:8]}",
            commit_sha=commit_sha,
            stage="cd",
            tags={"pipeline_run_id": run_id, "training_type": "full"}
        )

        mlflow_client.log_params({
            "model_type": "RandomForestClassifier",
            "n_estimators": 100,
            "max_depth": 15,
            "training_samples": 50000,
            "seed": 42
        })

        mlflow_client.log_metrics(metrics)
        mlflow_client.end_run()

        return {
            "mlflow_run_id": mlflow_run_id,
            "training_samples": 50000,
            "metrics": metrics,
            "model_version": f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        }

    async def _execute_evaluate_champion(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Evaluate challenger vs champion model."""
        await self.ws_manager.send_log(run_id, "Loading champion model...", "info")
        await asyncio.sleep(0.3)

        # Simulated champion metrics
        champion_metrics = {
            "accuracy": 0.90,
            "f1_score": 0.87,
            "auc_roc": 0.92
        }

        await self.ws_manager.send_log(
            run_id,
            f"Champion metrics: F1={champion_metrics['f1_score']:.3f}, AUC={champion_metrics['auc_roc']:.3f}",
            "info"
        )

        # Challenger metrics (from previous step simulation)
        if self.failure_modes.get("metric_regression"):
            challenger_metrics = {
                "accuracy": 0.68,
                "f1_score": 0.65,
                "auc_roc": 0.70
            }
        else:
            challenger_metrics = {
                "accuracy": 0.92,
                "f1_score": 0.89,
                "auc_roc": 0.94
            }

        await self.ws_manager.send_log(
            run_id,
            f"Challenger metrics: F1={challenger_metrics['f1_score']:.3f}, AUC={challenger_metrics['auc_roc']:.3f}",
            "info"
        )

        # Compare
        improvement = challenger_metrics["f1_score"] - champion_metrics["f1_score"]
        improvement_pct = (improvement / champion_metrics["f1_score"]) * 100

        challenger_wins = improvement > 0.01  # 1% threshold

        if challenger_wins:
            await self.ws_manager.send_log(
                run_id,
                f"Challenger WINS by {improvement_pct:.2f}% improvement",
                "info"
            )
        else:
            await self.ws_manager.send_log(
                run_id,
                f"Challenger does not beat champion (improvement: {improvement_pct:.2f}%)",
                "warning"
            )

        return {
            "champion_metrics": champion_metrics,
            "challenger_metrics": challenger_metrics,
            "improvement": improvement,
            "improvement_pct": improvement_pct,
            "challenger_wins": challenger_wins,
            "threshold": 0.01
        }

    async def _execute_manual_approval(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Wait for manual approval."""
        await self.ws_manager.send_log(
            run_id,
            "⏸️ Waiting for manual approval to proceed...",
            "info"
        )

        return {
            "status": "awaiting_approval",
            "message": "Click 'Approve' to proceed to deployment"
        }

    async def _execute_deploy_staging(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Deploy model to staging."""
        await self.ws_manager.send_log(run_id, "Deploying to staging environment...", "info")
        await asyncio.sleep(0.5)

        # Create deployment record
        from app.models import DeploymentState
        deployment = DeploymentState(
            environment="staging",
            model_version=f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            mlflow_run_id=run_id,
            status="active"
        )
        db.add(deployment)
        db.commit()

        await self.ws_manager.send_log(
            run_id,
            f"Deployed to staging: {deployment.model_version}",
            "info"
        )

        return {
            "environment": "staging",
            "model_version": deployment.model_version,
            "deployed_at": datetime.utcnow().isoformat()
        }

    async def _execute_shadow_monitor(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Run shadow scoring and monitor drift."""
        await self.ws_manager.send_log(run_id, "Starting shadow scoring...", "info")

        # Simulate shadow scoring on stream
        for batch in range(1, 6):
            await asyncio.sleep(0.4)

            # Simulated drift metrics
            psi = 0.05 + (batch * 0.01)
            accuracy = 0.91 - (batch * 0.005)

            await self.ws_manager.send_log(
                run_id,
                f"  Batch {batch}: PSI={psi:.3f}, Accuracy={accuracy:.3f}",
                "info"
            )

            await self.ws_manager.send_drift_update({
                "batch": batch,
                "psi": psi,
                "accuracy": accuracy,
                "timestamp": datetime.utcnow().isoformat()
            })

        # Final drift assessment
        drift_detected = False
        drift_metrics = {
            "mean_psi": 0.08,
            "max_psi": 0.10,
            "mean_accuracy": 0.89,
            "samples_scored": 500
        }

        await self.ws_manager.send_log(
            run_id,
            f"Shadow scoring complete. Drift: {'DETECTED' if drift_detected else 'NOT DETECTED'}",
            "warning" if drift_detected else "info"
        )

        return {
            "drift_detected": drift_detected,
            "drift_metrics": drift_metrics,
            "recommendation": "proceed" if not drift_detected else "investigate"
        }

    async def _execute_promote_prod(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Promote model to production."""
        await self.ws_manager.send_log(run_id, "Promoting to production...", "info")
        await asyncio.sleep(0.5)

        # Update deployment
        from app.models import DeploymentState, ModelRegistry

        # Archive current production
        current_prod = db.query(DeploymentState).filter(
            DeploymentState.environment == "production",
            DeploymentState.status == "active"
        ).first()

        if current_prod:
            current_prod.status = "archived"

        # Create new production deployment
        model_version = f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        deployment = DeploymentState(
            environment="production",
            model_version=model_version,
            mlflow_run_id=run_id,
            status="active"
        )
        db.add(deployment)

        # Update model registry
        registry_entry = ModelRegistry(
            model_name=settings.model_name,
            version=model_version,
            stage="production",
            mlflow_run_id=run_id,
            commit_sha=commit_sha,
            is_champion=True,
            promoted_at=datetime.utcnow(),
            metrics={"f1_score": 0.89, "auc_roc": 0.94}
        )
        db.add(registry_entry)

        db.commit()

        await self.ws_manager.send_log(
            run_id,
            f"🚀 Model promoted to production: {model_version}",
            "info"
        )

        return {
            "environment": "production",
            "model_version": model_version,
            "promoted_at": datetime.utcnow().isoformat(),
            "is_champion": True
        }

    async def _execute_rollback(
        self, run_id: str, commit_sha: str, db: Session
    ) -> Dict[str, Any]:
        """Rollback to previous model."""
        await self.ws_manager.send_log(run_id, "Initiating rollback...", "info")
        await asyncio.sleep(0.3)

        from app.models import DeploymentState

        # Get previous production deployment
        deployments = db.query(DeploymentState).filter(
            DeploymentState.environment == "production"
        ).order_by(DeploymentState.deployed_at.desc()).limit(2).all()

        if len(deployments) < 2:
            await self.ws_manager.send_log(
                run_id,
                "No previous version available for rollback",
                "warning"
            )
            return {"success": False, "reason": "No previous version"}

        current = deployments[0]
        previous = deployments[1]

        current.status = "rolled_back"

        rollback_deployment = DeploymentState(
            environment="production",
            model_version=previous.model_version,
            mlflow_run_id=previous.mlflow_run_id,
            deployed_by="rollback",
            status="active"
        )
        db.add(rollback_deployment)
        db.commit()

        await self.ws_manager.send_log(
            run_id,
            f"Rolled back from {current.model_version} to {previous.model_version}",
            "info"
        )

        return {
            "success": True,
            "from_version": current.model_version,
            "to_version": previous.model_version
        }
