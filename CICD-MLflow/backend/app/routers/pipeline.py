"""
Pipeline API router.
Handles pipeline run management and control endpoints.
"""

from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import Optional
from pydantic import BaseModel

router = APIRouter()


class PipelineStartRequest(BaseModel):
    """Request body for starting a pipeline."""
    commit_sha: Optional[str] = None
    stage: str = "ci"


class ApprovalRequest(BaseModel):
    """Request body for approval/rejection."""
    approved: bool = True
    reason: Optional[str] = None


@router.post("/start")
async def start_pipeline(
    request: PipelineStartRequest,
    req: Request
):
    """
    Start a new pipeline run.

    Args:
        request: Pipeline configuration
        req: FastAPI request object

    Returns:
        Pipeline run information including run_id
    """
    pipeline_engine = req.app.state.pipeline_engine

    result = await pipeline_engine.start_pipeline(
        commit_sha=request.commit_sha,
        stage=request.stage
    )

    return result


@router.post("/step/{step_name}/run")
async def run_step(
    step_name: str,
    run_id: str,
    req: Request
):
    """
    Run a specific pipeline step.

    Args:
        step_name: Name of the step to run
        run_id: Pipeline run ID
        req: FastAPI request object

    Returns:
        Step execution result
    """
    pipeline_engine = req.app.state.pipeline_engine

    try:
        result = await pipeline_engine.run_single_step(run_id, step_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{run_id}/status")
async def get_status(run_id: str, req: Request):
    """
    Get the status of a pipeline run.

    Args:
        run_id: Pipeline run ID
        req: FastAPI request object

    Returns:
        Pipeline status including all step states
    """
    pipeline_engine = req.app.state.pipeline_engine

    try:
        status = pipeline_engine.get_status(run_id)
        return status
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/runs")
async def list_runs(req: Request, limit: int = 20):
    """
    List recent pipeline runs.

    Args:
        req: FastAPI request object
        limit: Maximum number of runs to return

    Returns:
        List of pipeline run summaries
    """
    pipeline_engine = req.app.state.pipeline_engine
    return pipeline_engine.list_runs(limit=limit)


@router.post("/{run_id}/approve")
async def approve_pipeline(run_id: str, req: Request):
    """
    Approve a pending manual approval step.

    Args:
        run_id: Pipeline run ID
        req: FastAPI request object

    Returns:
        Approval result
    """
    pipeline_engine = req.app.state.pipeline_engine

    try:
        result = await pipeline_engine.approve_step(run_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{run_id}/reject")
async def reject_pipeline(
    run_id: str,
    request: ApprovalRequest,
    req: Request
):
    """
    Reject a pending manual approval step.

    Args:
        run_id: Pipeline run ID
        request: Rejection details
        req: FastAPI request object

    Returns:
        Rejection result
    """
    pipeline_engine = req.app.state.pipeline_engine

    try:
        result = await pipeline_engine.reject_step(run_id, request.reason or "")
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rollback")
async def rollback(
    req: Request,
    environment: str = "production"
):
    """
    Rollback to the previous model version.

    Args:
        req: FastAPI request object
        environment: Target environment

    Returns:
        Rollback result
    """
    pipeline_engine = req.app.state.pipeline_engine

    try:
        result = await pipeline_engine.rollback(environment)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/continue/{run_id}")
async def continue_pipeline(
    run_id: str,
    stage: str,
    req: Request
):
    """
    Continue a pipeline with the next stage.

    Args:
        run_id: Pipeline run ID
        stage: Stage to continue with (cd, deploy)
        req: FastAPI request object

    Returns:
        Continuation result
    """
    pipeline_engine = req.app.state.pipeline_engine

    if stage not in ["cd", "deploy"]:
        raise HTTPException(status_code=400, detail="Invalid stage")

    try:
        status = pipeline_engine.get_status(run_id)
        commit_sha = status["commit_sha"]

        # Update stage in DB and continue
        from app.database import SessionLocal
        from app.models import PipelineRun

        db = SessionLocal()
        try:
            pipeline = db.query(PipelineRun).filter(
                PipelineRun.id == run_id
            ).first()

            if pipeline:
                pipeline.stage = stage
                pipeline.status = "running"
                db.commit()
        finally:
            db.close()

        # Continue execution
        import asyncio
        task = asyncio.create_task(
            pipeline_engine._run_pipeline(run_id, commit_sha, stage)
        )
        pipeline_engine.active_runs[run_id] = task

        return {
            "run_id": run_id,
            "stage": stage,
            "status": "running"
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/commit")
async def fake_commit(req: Request):
    """
    Generate a fake commit and start CI pipeline.

    Returns:
        New commit SHA and pipeline run info
    """
    pipeline_engine = req.app.state.pipeline_engine

    commit_sha = pipeline_engine.generate_commit_sha()
    result = await pipeline_engine.start_pipeline(
        commit_sha=commit_sha,
        stage="ci"
    )

    return {
        **result,
        "message": f"Fake commit {commit_sha} created and CI pipeline started"
    }
