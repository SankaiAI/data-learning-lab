"""
MLflow API router.
Provides endpoints for browsing MLflow runs, metrics, and artifacts.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse, Response
from typing import Optional, List
import httpx
import io

router = APIRouter()


@router.get("/runs")
async def list_runs(
    req: Request,
    stage: Optional[str] = None,
    commit_sha: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    """
    List MLflow runs with optional filtering.

    Args:
        req: FastAPI request object
        stage: Filter by stage (ci/cd)
        commit_sha: Filter by commit SHA
        limit: Maximum runs to return

    Returns:
        List of runs with metadata
    """
    mlflow_client = req.app.state.mlflow_client

    # Build filter string
    filters = []
    if stage:
        filters.append(f"tags.stage = '{stage}'")
    if commit_sha:
        filters.append(f"tags.commit_sha = '{commit_sha}'")

    filter_string = " AND ".join(filters) if filters else None

    runs = mlflow_client.list_runs(
        filter_string=filter_string,
        max_results=limit
    )

    return {"runs": runs, "count": len(runs)}


@router.get("/runs/{run_id}")
async def get_run(run_id: str, req: Request):
    """
    Get details for a specific MLflow run.

    Args:
        run_id: MLflow run ID
        req: FastAPI request object

    Returns:
        Run details including params, metrics, and tags
    """
    mlflow_client = req.app.state.mlflow_client

    try:
        run = mlflow_client.get_run(run_id)
        return run
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Run not found: {e}")


@router.get("/runs/{run_id}/artifacts")
async def list_artifacts(
    run_id: str,
    req: Request,
    path: str = ""
):
    """
    List artifacts for a run.

    Args:
        run_id: MLflow run ID
        req: FastAPI request object
        path: Artifact subdirectory path

    Returns:
        List of artifact info
    """
    mlflow_client = req.app.state.mlflow_client

    try:
        artifacts = mlflow_client.list_artifacts(run_id, path)
        return {"artifacts": artifacts, "path": path}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error listing artifacts: {e}")


@router.get("/runs/{run_id}/artifacts/{artifact_path:path}")
async def get_artifact(
    run_id: str,
    artifact_path: str,
    req: Request
):
    """
    Get an artifact file.

    Args:
        run_id: MLflow run ID
        artifact_path: Path to the artifact
        req: FastAPI request object

    Returns:
        Artifact content
    """
    mlflow_client = req.app.state.mlflow_client

    try:
        artifact_uri = mlflow_client.get_artifact_uri(run_id, artifact_path)

        # Determine content type
        if artifact_path.endswith('.png'):
            content_type = "image/png"
        elif artifact_path.endswith('.jpg') or artifact_path.endswith('.jpeg'):
            content_type = "image/jpeg"
        elif artifact_path.endswith('.json'):
            content_type = "application/json"
        elif artifact_path.endswith('.md'):
            content_type = "text/markdown"
        else:
            content_type = "application/octet-stream"

        # For S3/MinIO artifacts, fetch via HTTP
        if artifact_uri.startswith('s3://'):
            # Convert S3 URI to MinIO URL
            from app.config import settings
            bucket_path = artifact_uri.replace('s3://', '')
            minio_url = f"{settings.mlflow_s3_endpoint_url}/{bucket_path}"

            async with httpx.AsyncClient() as client:
                response = await client.get(minio_url)
                return Response(
                    content=response.content,
                    media_type=content_type
                )

        return {"artifact_uri": artifact_uri}

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Artifact not found: {e}")


@router.get("/experiments")
async def list_experiments(req: Request):
    """
    List all MLflow experiments.

    Returns:
        List of experiments
    """
    import mlflow

    experiments = mlflow.search_experiments()

    return {
        "experiments": [
            {
                "experiment_id": exp.experiment_id,
                "name": exp.name,
                "artifact_location": exp.artifact_location,
                "lifecycle_stage": exp.lifecycle_stage,
                "tags": dict(exp.tags)
            }
            for exp in experiments
        ]
    }


@router.get("/models")
async def list_models(req: Request):
    """
    List registered models.

    Returns:
        List of registered models
    """
    from mlflow.tracking import MlflowClient

    client = MlflowClient()

    try:
        models = client.search_registered_models()

        return {
            "models": [
                {
                    "name": model.name,
                    "creation_timestamp": model.creation_timestamp,
                    "last_updated_timestamp": model.last_updated_timestamp,
                    "description": model.description,
                    "latest_versions": [
                        {
                            "version": v.version,
                            "stage": v.current_stage,
                            "run_id": v.run_id
                        }
                        for v in (model.latest_versions or [])
                    ]
                }
                for model in models
            ]
        }
    except Exception as e:
        return {"models": [], "error": str(e)}


@router.get("/models/{model_name}/versions")
async def get_model_versions(model_name: str, req: Request):
    """
    Get all versions of a registered model.

    Args:
        model_name: Model name

    Returns:
        List of model versions
    """
    from mlflow.tracking import MlflowClient

    client = MlflowClient()

    try:
        versions = client.search_model_versions(f"name='{model_name}'")

        return {
            "model_name": model_name,
            "versions": [
                {
                    "version": v.version,
                    "stage": v.current_stage,
                    "run_id": v.run_id,
                    "status": v.status,
                    "creation_timestamp": v.creation_timestamp
                }
                for v in versions
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Model not found: {e}")


@router.get("/champion")
async def get_champion(req: Request):
    """
    Get the current champion (production) model.

    Returns:
        Champion model info
    """
    mlflow_client = req.app.state.mlflow_client

    champion = mlflow_client.get_champion_model()

    if champion:
        return {"champion": champion}
    else:
        return {"champion": None, "message": "No production model found"}


@router.post("/compare")
async def compare_models(
    req: Request,
    challenger_run_id: str,
    champion_run_id: str,
    metric: str = "f1_score"
):
    """
    Compare two models (challenger vs champion).

    Args:
        req: FastAPI request object
        challenger_run_id: Challenger run ID
        champion_run_id: Champion run ID
        metric: Metric to compare

    Returns:
        Comparison results
    """
    mlflow_client = req.app.state.mlflow_client

    try:
        comparison = mlflow_client.compare_models(
            challenger_run_id,
            champion_run_id,
            metric
        )
        return comparison
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Comparison failed: {e}")
