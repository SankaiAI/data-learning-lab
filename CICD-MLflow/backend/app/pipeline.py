"""
Pipeline engine for orchestrating CI/CD steps.
Manages step execution, status updates, and MLflow integration.
"""

import asyncio
import uuid
import hashlib
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import PipelineRun, PipelineStep, StepStatus, ModelRegistry, DeploymentState
from app.websocket_manager import WebSocketManager
from app.steps import STEP_DEFINITIONS, StepExecutor

logger = logging.getLogger(__name__)


class PipelineEngine:
    """
    Orchestrates the execution of CI/CD pipeline steps.

    Manages the flow from commit through CI tests, training,
    evaluation, approval, and deployment stages.
    """

    def __init__(self, ws_manager: WebSocketManager):
        """
        Initialize the pipeline engine.

        Args:
            ws_manager: WebSocket manager for broadcasting updates
        """
        self.ws_manager = ws_manager
        self.active_runs: Dict[str, asyncio.Task] = {}
        self.step_executor = StepExecutor(ws_manager)

        # Approval states for runs awaiting manual approval
        self.pending_approvals: Dict[str, Dict[str, Any]] = {}

    def generate_commit_sha(self) -> str:
        """Generate a fake commit SHA for simulation."""
        timestamp = datetime.utcnow().isoformat()
        return hashlib.sha1(timestamp.encode()).hexdigest()[:8]

    def generate_run_id(self) -> str:
        """Generate a unique run ID."""
        return f"run_{uuid.uuid4().hex[:12]}"

    async def start_pipeline(
        self,
        commit_sha: Optional[str] = None,
        stage: str = "ci"
    ) -> Dict[str, Any]:
        """
        Start a new pipeline run.

        Args:
            commit_sha: Optional commit SHA (generated if not provided)
            stage: Starting stage (ci, cd, deploy)

        Returns:
            Dictionary with run_id and initial status
        """
        run_id = self.generate_run_id()
        commit_sha = commit_sha or self.generate_commit_sha()

        # Create database record
        db = SessionLocal()
        try:
            pipeline_run = PipelineRun(
                id=run_id,
                commit_sha=commit_sha,
                status="running",
                stage=stage,
                metadata_json={
                    "started_at": datetime.utcnow().isoformat(),
                    "seed": 42  # Reproducibility seed
                }
            )
            db.add(pipeline_run)

            # Create step records
            for step_def in STEP_DEFINITIONS:
                step = PipelineStep(
                    run_id=run_id,
                    step_name=step_def["name"],
                    status=StepStatus.IDLE.value
                )
                db.add(step)

            db.commit()

            # Notify connected clients
            await self.ws_manager.send_log(
                run_id,
                f"Pipeline started for commit {commit_sha}",
                "info"
            )

            # Start pipeline execution in background
            task = asyncio.create_task(self._run_pipeline(run_id, commit_sha, stage))
            self.active_runs[run_id] = task

            return {
                "run_id": run_id,
                "commit_sha": commit_sha,
                "status": "running",
                "stage": stage
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to start pipeline: {e}")
            raise
        finally:
            db.close()

    async def _run_pipeline(self, run_id: str, commit_sha: str, stage: str):
        """
        Execute pipeline steps in sequence.

        Args:
            run_id: The pipeline run ID
            commit_sha: Git commit SHA
            stage: Current stage
        """
        db = SessionLocal()

        try:
            # Get steps based on stage
            if stage == "ci":
                steps_to_run = [
                    "commit_received",
                    "ci_tests",
                    "data_validation",
                    "ci_quick_train",
                    "mlflow_log_ci"
                ]
            elif stage == "cd":
                steps_to_run = [
                    "cd_full_train",
                    "evaluate_vs_champion",
                    "manual_approval"
                ]
            else:  # deploy
                steps_to_run = [
                    "deploy_staging",
                    "shadow_monitor",
                    "promote_prod"
                ]

            # Execute each step
            for step_name in steps_to_run:
                step = db.query(PipelineStep).filter(
                    PipelineStep.run_id == run_id,
                    PipelineStep.step_name == step_name
                ).first()

                if not step:
                    continue

                # Update status to running
                step.status = StepStatus.RUNNING.value
                step.started_at = datetime.utcnow()
                db.commit()

                await self.ws_manager.send_status(
                    run_id, step_name, StepStatus.RUNNING.value
                )

                try:
                    # Execute the step
                    result = await self.step_executor.execute(
                        step_name=step_name,
                        run_id=run_id,
                        commit_sha=commit_sha,
                        db=db
                    )

                    # Handle approval steps
                    if step_name == "manual_approval":
                        self.pending_approvals[run_id] = {
                            "step_name": step_name,
                            "timestamp": datetime.utcnow().isoformat(),
                            "metrics": result.get("metrics", {})
                        }

                        # Wait for approval
                        step.status = StepStatus.QUEUED.value
                        db.commit()

                        await self.ws_manager.send_status(
                            run_id, step_name, "awaiting_approval",
                            message="Waiting for manual approval to proceed"
                        )

                        # Exit pipeline - will resume after approval
                        return

                    # Update step with results
                    step.status = StepStatus.SUCCESS.value
                    step.completed_at = datetime.utcnow()
                    step.outputs = result
                    db.commit()

                    await self.ws_manager.send_status(
                        run_id, step_name, StepStatus.SUCCESS.value,
                        outputs=result
                    )

                except Exception as e:
                    logger.error(f"Step {step_name} failed: {e}")
                    step.status = StepStatus.FAILED.value
                    step.completed_at = datetime.utcnow()
                    step.error_message = str(e)
                    db.commit()

                    await self.ws_manager.send_status(
                        run_id, step_name, StepStatus.FAILED.value,
                        error=str(e)
                    )

                    # Update pipeline status
                    pipeline = db.query(PipelineRun).filter(
                        PipelineRun.id == run_id
                    ).first()
                    if pipeline:
                        pipeline.status = "failed"
                        db.commit()

                    return

            # Pipeline completed successfully
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()
            if pipeline:
                # Determine next stage
                if stage == "ci":
                    pipeline.status = "ci_complete"
                    await self.ws_manager.send_log(
                        run_id,
                        "CI stage complete. Ready for CD.",
                        "info"
                    )
                elif stage == "cd":
                    pipeline.status = "cd_complete"
                else:
                    pipeline.status = "completed"

                db.commit()

        except Exception as e:
            logger.error(f"Pipeline execution error: {e}")
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()
            if pipeline:
                pipeline.status = "failed"
                db.commit()
        finally:
            db.close()

    async def run_single_step(
        self,
        run_id: str,
        step_name: str
    ) -> Dict[str, Any]:
        """
        Run a single pipeline step.

        Args:
            run_id: The pipeline run ID
            step_name: Name of the step to run

        Returns:
            Step execution result
        """
        db = SessionLocal()

        try:
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()

            if not pipeline:
                raise ValueError(f"Pipeline run {run_id} not found")

            step = db.query(PipelineStep).filter(
                PipelineStep.run_id == run_id,
                PipelineStep.step_name == step_name
            ).first()

            if not step:
                raise ValueError(f"Step {step_name} not found in run {run_id}")

            # Update status
            step.status = StepStatus.RUNNING.value
            step.started_at = datetime.utcnow()
            db.commit()

            await self.ws_manager.send_status(
                run_id, step_name, StepStatus.RUNNING.value
            )

            # Execute
            result = await self.step_executor.execute(
                step_name=step_name,
                run_id=run_id,
                commit_sha=pipeline.commit_sha,
                db=db
            )

            step.status = StepStatus.SUCCESS.value
            step.completed_at = datetime.utcnow()
            step.outputs = result
            db.commit()

            await self.ws_manager.send_status(
                run_id, step_name, StepStatus.SUCCESS.value,
                outputs=result
            )

            return result

        except Exception as e:
            logger.error(f"Step {step_name} execution failed: {e}")
            if step:
                step.status = StepStatus.FAILED.value
                step.error_message = str(e)
                db.commit()

            await self.ws_manager.send_status(
                run_id, step_name, StepStatus.FAILED.value,
                error=str(e)
            )
            raise
        finally:
            db.close()

    async def approve_step(self, run_id: str) -> Dict[str, Any]:
        """
        Approve a pending manual approval step.

        Args:
            run_id: The pipeline run ID

        Returns:
            Approval result
        """
        if run_id not in self.pending_approvals:
            raise ValueError(f"No pending approval for run {run_id}")

        approval_info = self.pending_approvals.pop(run_id)

        db = SessionLocal()
        try:
            step = db.query(PipelineStep).filter(
                PipelineStep.run_id == run_id,
                PipelineStep.step_name == "manual_approval"
            ).first()

            if step:
                step.status = StepStatus.SUCCESS.value
                step.completed_at = datetime.utcnow()
                step.outputs = {
                    "approved": True,
                    "approved_at": datetime.utcnow().isoformat()
                }
                db.commit()

            await self.ws_manager.send_status(
                run_id, "manual_approval", StepStatus.SUCCESS.value,
                message="Approved! Continuing to deployment."
            )

            # Continue pipeline with deploy stage
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()

            if pipeline:
                pipeline.stage = "deploy"
                db.commit()

                # Resume pipeline
                task = asyncio.create_task(
                    self._run_pipeline(run_id, pipeline.commit_sha, "deploy")
                )
                self.active_runs[run_id] = task

            return {"approved": True, "run_id": run_id}

        finally:
            db.close()

    async def reject_step(self, run_id: str, reason: str = "") -> Dict[str, Any]:
        """
        Reject a pending manual approval step.

        Args:
            run_id: The pipeline run ID
            reason: Rejection reason

        Returns:
            Rejection result
        """
        if run_id not in self.pending_approvals:
            raise ValueError(f"No pending approval for run {run_id}")

        self.pending_approvals.pop(run_id)

        db = SessionLocal()
        try:
            step = db.query(PipelineStep).filter(
                PipelineStep.run_id == run_id,
                PipelineStep.step_name == "manual_approval"
            ).first()

            if step:
                step.status = StepStatus.FAILED.value
                step.completed_at = datetime.utcnow()
                step.outputs = {"approved": False, "reason": reason}
                step.error_message = f"Rejected: {reason}"
                db.commit()

            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()
            if pipeline:
                pipeline.status = "rejected"
                db.commit()

            await self.ws_manager.send_status(
                run_id, "manual_approval", StepStatus.FAILED.value,
                message=f"Rejected: {reason}"
            )

            return {"approved": False, "reason": reason, "run_id": run_id}

        finally:
            db.close()

    async def rollback(self, environment: str = "production") -> Dict[str, Any]:
        """
        Rollback to the previous model version.

        Args:
            environment: Target environment (staging/production)

        Returns:
            Rollback result
        """
        db = SessionLocal()
        try:
            # Get current and previous deployments
            deployments = db.query(DeploymentState).filter(
                DeploymentState.environment == environment
            ).order_by(DeploymentState.deployed_at.desc()).limit(2).all()

            if len(deployments) < 2:
                raise ValueError("No previous version to rollback to")

            current = deployments[0]
            previous = deployments[1]

            # Create rollback deployment
            rollback_deployment = DeploymentState(
                environment=environment,
                model_version=previous.model_version,
                mlflow_run_id=previous.mlflow_run_id,
                deployed_by="rollback",
                status="active"
            )
            db.add(rollback_deployment)

            # Mark current as rolled back
            current.status = "rolled_back"

            db.commit()

            await self.ws_manager.broadcast_all({
                "type": "rollback",
                "environment": environment,
                "from_version": current.model_version,
                "to_version": previous.model_version
            })

            return {
                "success": True,
                "environment": environment,
                "from_version": current.model_version,
                "to_version": previous.model_version
            }

        finally:
            db.close()

    def get_status(self, run_id: str) -> Dict[str, Any]:
        """
        Get the current status of a pipeline run.

        Args:
            run_id: The pipeline run ID

        Returns:
            Pipeline status dictionary
        """
        db = SessionLocal()
        try:
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()

            if not pipeline:
                raise ValueError(f"Pipeline run {run_id} not found")

            steps = db.query(PipelineStep).filter(
                PipelineStep.run_id == run_id
            ).all()

            return {
                "run_id": pipeline.id,
                "commit_sha": pipeline.commit_sha,
                "status": pipeline.status,
                "stage": pipeline.stage,
                "mlflow_run_id": pipeline.mlflow_run_id,
                "created_at": pipeline.created_at.isoformat(),
                "steps": [
                    {
                        "name": s.step_name,
                        "status": s.status,
                        "started_at": s.started_at.isoformat() if s.started_at else None,
                        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                        "outputs": s.outputs,
                        "error": s.error_message
                    }
                    for s in steps
                ],
                "pending_approval": run_id in self.pending_approvals
            }
        finally:
            db.close()

    def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        List recent pipeline runs.

        Args:
            limit: Maximum number of runs to return

        Returns:
            List of pipeline run summaries
        """
        db = SessionLocal()
        try:
            runs = db.query(PipelineRun).order_by(
                PipelineRun.created_at.desc()
            ).limit(limit).all()

            return [
                {
                    "run_id": r.id,
                    "commit_sha": r.commit_sha,
                    "status": r.status,
                    "stage": r.stage,
                    "created_at": r.created_at.isoformat()
                }
                for r in runs
            ]
        finally:
            db.close()
