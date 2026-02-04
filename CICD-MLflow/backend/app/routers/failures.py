"""
Failure Modes API router.
Provides endpoints for toggling failure scenarios for testing.
"""

from fastapi import APIRouter, Request, HTTPException
from typing import Dict
from pydantic import BaseModel

router = APIRouter()


class FailureModeRequest(BaseModel):
    """Request body for setting failure mode."""
    enabled: bool


# Available failure modes with descriptions
FAILURE_MODES = {
    "schema_validation": {
        "name": "Schema Validation Failure",
        "description": "Causes data validation step to fail due to missing required column",
        "step_affected": "data_validation",
        "default": False
    },
    "metric_regression": {
        "name": "Metric Regression",
        "description": "Causes model to perform worse than champion (fails evaluation)",
        "step_affected": "evaluate_vs_champion",
        "default": False
    },
    "mlflow_connection": {
        "name": "MLflow Connection Failure",
        "description": "Simulates MLflow server connection failure",
        "step_affected": "mlflow_log_ci",
        "default": False
    },
    "training_error": {
        "name": "Training Error",
        "description": "Causes CI tests to fail",
        "step_affected": "ci_tests",
        "default": False
    }
}


@router.get("")
async def list_failure_modes(req: Request):
    """
    List all available failure modes and their current state.

    Returns:
        Dictionary of failure modes with status
    """
    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    modes = {}
    for mode_id, mode_info in FAILURE_MODES.items():
        modes[mode_id] = {
            **mode_info,
            "enabled": step_executor.failure_modes.get(mode_id, False)
        }

    return {"failure_modes": modes}


@router.get("/{mode_id}")
async def get_failure_mode(mode_id: str, req: Request):
    """
    Get status of a specific failure mode.

    Args:
        mode_id: Failure mode identifier
        req: FastAPI request object

    Returns:
        Failure mode status
    """
    if mode_id not in FAILURE_MODES:
        raise HTTPException(status_code=404, detail=f"Failure mode '{mode_id}' not found")

    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    return {
        "mode_id": mode_id,
        **FAILURE_MODES[mode_id],
        "enabled": step_executor.failure_modes.get(mode_id, False)
    }


@router.post("/{mode_id}")
async def set_failure_mode(
    mode_id: str,
    request: FailureModeRequest,
    req: Request
):
    """
    Enable or disable a failure mode.

    Args:
        mode_id: Failure mode identifier
        request: Request body with enabled flag
        req: FastAPI request object

    Returns:
        Updated failure mode status
    """
    if mode_id not in FAILURE_MODES:
        raise HTTPException(status_code=404, detail=f"Failure mode '{mode_id}' not found")

    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    step_executor.set_failure_mode(mode_id, request.enabled)

    return {
        "mode_id": mode_id,
        "enabled": request.enabled,
        "message": f"Failure mode '{mode_id}' {'enabled' if request.enabled else 'disabled'}"
    }


@router.post("/{mode_id}/toggle")
async def toggle_failure_mode(mode_id: str, req: Request):
    """
    Toggle a failure mode on/off.

    Args:
        mode_id: Failure mode identifier
        req: FastAPI request object

    Returns:
        Updated failure mode status
    """
    if mode_id not in FAILURE_MODES:
        raise HTTPException(status_code=404, detail=f"Failure mode '{mode_id}' not found")

    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    current = step_executor.failure_modes.get(mode_id, False)
    new_state = not current

    step_executor.set_failure_mode(mode_id, new_state)

    return {
        "mode_id": mode_id,
        "enabled": new_state,
        "message": f"Failure mode '{mode_id}' toggled to {'enabled' if new_state else 'disabled'}"
    }


@router.post("/reset")
async def reset_all_failure_modes(req: Request):
    """
    Reset all failure modes to disabled.

    Returns:
        Reset status
    """
    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    for mode_id in FAILURE_MODES:
        step_executor.set_failure_mode(mode_id, False)

    return {
        "message": "All failure modes reset to disabled",
        "modes_reset": list(FAILURE_MODES.keys())
    }


@router.post("/enable-all")
async def enable_all_failure_modes(req: Request):
    """
    Enable all failure modes (chaos mode).

    Returns:
        Enable status
    """
    pipeline_engine = req.app.state.pipeline_engine
    step_executor = pipeline_engine.step_executor

    for mode_id in FAILURE_MODES:
        step_executor.set_failure_mode(mode_id, True)

    return {
        "message": "All failure modes enabled (chaos mode)",
        "modes_enabled": list(FAILURE_MODES.keys())
    }
