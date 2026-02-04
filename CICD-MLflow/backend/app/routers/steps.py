"""
Steps API router.
Provides endpoints for step definitions, code, and configuration.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from typing import List
import os
import yaml

from app.steps import STEP_DEFINITIONS, get_step_definition
from app.models import StepDefinition

router = APIRouter()


# Base path for code and config files
BASE_PATH = "/app"


@router.get("", response_model=List[StepDefinition])
async def list_steps():
    """
    List all pipeline step definitions.

    Returns:
        List of step definitions with metadata
    """
    return [
        StepDefinition(**step)
        for step in STEP_DEFINITIONS
    ]


@router.get("/{step_name}")
async def get_step(step_name: str):
    """
    Get a specific step definition.

    Args:
        step_name: Name of the step

    Returns:
        Step definition
    """
    step = get_step_definition(step_name)
    if not step:
        raise HTTPException(status_code=404, detail=f"Step '{step_name}' not found")

    return StepDefinition(**step)


@router.get("/{step_name}/code", response_class=PlainTextResponse)
async def get_step_code(step_name: str):
    """
    Get the source code for a step.

    Args:
        step_name: Name of the step

    Returns:
        Source code as plain text
    """
    step = get_step_definition(step_name)
    if not step:
        raise HTTPException(status_code=404, detail=f"Step '{step_name}' not found")

    code_file = step["code_file"]
    code_path = os.path.join(BASE_PATH, code_file)

    # If file doesn't exist, return template code
    if not os.path.exists(code_path):
        return get_template_code(step_name)

    try:
        with open(code_path, "r") as f:
            return f.read()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading code file: {e}")


@router.get("/{step_name}/config")
async def get_step_config(step_name: str):
    """
    Get the configuration for a step.

    Args:
        step_name: Name of the step

    Returns:
        Configuration as JSON/YAML
    """
    step = get_step_definition(step_name)
    if not step:
        raise HTTPException(status_code=404, detail=f"Step '{step_name}' not found")

    config_file = step["config_file"]
    config_path = os.path.join(BASE_PATH, config_file)

    # If file doesn't exist, return template config
    if not os.path.exists(config_path):
        return get_template_config(step_name)

    try:
        with open(config_path, "r") as f:
            if config_file.endswith(".yaml") or config_file.endswith(".yml"):
                return yaml.safe_load(f)
            else:
                import json
                return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading config file: {e}")


def get_template_code(step_name: str) -> str:
    """Return template code for a step."""

    templates = {
        "commit_received": '''"""
Commit Handler - Triggered when a new commit/PR is received.
Validates the commit and prepares the pipeline context.
"""

import hashlib
from datetime import datetime
from typing import Dict, Any


def handle_commit(commit_sha: str, branch: str = "main") -> Dict[str, Any]:
    """
    Process a new commit and prepare for pipeline execution.

    Args:
        commit_sha: Git commit SHA
        branch: Git branch name

    Returns:
        Commit context for pipeline
    """
    # Validate commit SHA format
    if len(commit_sha) < 7:
        raise ValueError("Invalid commit SHA")

    # Create pipeline context
    context = {
        "commit_sha": commit_sha,
        "branch": branch,
        "timestamp": datetime.utcnow().isoformat(),
        "triggered_by": "push",
        "seed": int(hashlib.md5(commit_sha.encode()).hexdigest()[:8], 16) % 10000
    }

    return context


if __name__ == "__main__":
    # Example usage
    result = handle_commit("abc1234")
    print(f"Commit processed: {result}")
''',

        "ci_tests": '''"""
CI Tests - Run unit tests, integration tests, and linting.
Ensures code quality before proceeding with training.
"""

import subprocess
import sys
from typing import Dict, List, Tuple


def run_unit_tests() -> Tuple[int, int]:
    """
    Run unit tests using pytest.

    Returns:
        Tuple of (passed, failed) counts
    """
    # Simulated test results
    # In production, would run: pytest tests/unit -v
    passed = 15
    failed = 0
    return passed, failed


def run_integration_tests() -> Tuple[int, int]:
    """
    Run integration tests.

    Returns:
        Tuple of (passed, failed) counts
    """
    passed = 8
    failed = 0
    return passed, failed


def run_linting() -> Dict[str, any]:
    """
    Run code linting with flake8/black.

    Returns:
        Linting results
    """
    # In production: flake8 . --count --select=E9,F63,F7,F82
    return {
        "errors": 0,
        "warnings": 3,
        "style_issues": 0
    }


def run_all_tests() -> Dict[str, any]:
    """
    Run all CI tests and aggregate results.

    Returns:
        Aggregated test results
    """
    unit_passed, unit_failed = run_unit_tests()
    integration_passed, integration_failed = run_integration_tests()
    lint_results = run_linting()

    total_passed = unit_passed + integration_passed
    total_failed = unit_failed + integration_failed

    return {
        "unit_tests": {"passed": unit_passed, "failed": unit_failed},
        "integration_tests": {"passed": integration_passed, "failed": integration_failed},
        "linting": lint_results,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "success": total_failed == 0 and lint_results["errors"] == 0
    }


if __name__ == "__main__":
    results = run_all_tests()
    print(f"Test Results: {results}")
    sys.exit(0 if results["success"] else 1)
''',

        "data_validation": '''"""
Data Validation - Validate data schema and quality.
Ensures training data meets requirements before model training.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Any


# Expected schema for claims data
EXPECTED_SCHEMA = {
    "claim_id": "string",
    "cpt_bucket": "category",
    "provider_type": "category",
    "billed_amount": "float64",
    "allowed_amount": "float64",
    "diagnosis_group": "category",
    "patient_age": "int64",
    "service_date": "datetime64",
    "settlement_outcome": "int64"  # Target variable
}


def validate_schema(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate DataFrame schema against expected schema.

    Args:
        df: Input DataFrame

    Returns:
        Validation results
    """
    missing_columns = []
    type_mismatches = []

    for col, expected_type in EXPECTED_SCHEMA.items():
        if col not in df.columns:
            missing_columns.append(col)
        # Type checking would go here

    return {
        "valid": len(missing_columns) == 0,
        "missing_columns": missing_columns,
        "type_mismatches": type_mismatches
    }


def validate_nulls(df: pd.DataFrame, threshold: float = 0.05) -> Dict[str, Any]:
    """
    Check for null values exceeding threshold.

    Args:
        df: Input DataFrame
        threshold: Maximum allowed null percentage

    Returns:
        Null validation results
    """
    null_pcts = df.isnull().mean()
    columns_over_threshold = null_pcts[null_pcts > threshold].to_dict()

    return {
        "valid": len(columns_over_threshold) == 0,
        "null_percentages": null_pcts.to_dict(),
        "columns_over_threshold": columns_over_threshold
    }


def validate_ranges(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate numeric columns are within expected ranges.

    Args:
        df: Input DataFrame

    Returns:
        Range validation results
    """
    issues = []

    if "billed_amount" in df.columns:
        if (df["billed_amount"] < 0).any():
            issues.append("Negative billed_amount found")

    if "patient_age" in df.columns:
        if (df["patient_age"] < 0).any() or (df["patient_age"] > 120).any():
            issues.append("Invalid patient_age values")

    return {
        "valid": len(issues) == 0,
        "issues": issues
    }


def run_validation(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Run all data validations.

    Args:
        df: Input DataFrame

    Returns:
        Complete validation results
    """
    schema_result = validate_schema(df)
    null_result = validate_nulls(df)
    range_result = validate_ranges(df)

    all_valid = all([
        schema_result["valid"],
        null_result["valid"],
        range_result["valid"]
    ])

    return {
        "schema_validation": schema_result,
        "null_validation": null_result,
        "range_validation": range_result,
        "overall_valid": all_valid,
        "records_checked": len(df)
    }


if __name__ == "__main__":
    # Example with synthetic data
    df = pd.DataFrame({
        "claim_id": ["C001", "C002"],
        "billed_amount": [100.0, 200.0],
        "settlement_outcome": [1, 0]
    })
    results = run_validation(df)
    print(f"Validation Results: {results}")
''',

        "ci_quick_train": '''"""
CI Quick Train - Fast training on sample data for validation.
Runs a quick training cycle to validate the pipeline works.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from typing import Dict, Any, Tuple
import time


def generate_sample_data(n_samples: int = 1000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic claims data for quick training.

    Args:
        n_samples: Number of samples to generate
        seed: Random seed for reproducibility

    Returns:
        Tuple of (features, labels)
    """
    np.random.seed(seed)

    # Features: CPT bucket, provider type, billed amount, allowed amount, etc.
    X = np.column_stack([
        np.random.randint(0, 10, n_samples),  # CPT bucket
        np.random.randint(0, 5, n_samples),   # Provider type
        np.random.exponential(500, n_samples), # Billed amount
        np.random.exponential(400, n_samples), # Allowed amount
        np.random.randint(0, 20, n_samples),  # Diagnosis group
        np.random.randint(18, 85, n_samples), # Patient age
    ])

    # Target: settlement outcome (0 = denied, 1 = approved)
    # Based on simple rules + noise
    y = (
        (X[:, 2] < 1000) &  # Lower billed amounts more likely approved
        (X[:, 5] > 25)      # Non-pediatric more likely approved
    ).astype(int)

    # Add noise
    noise_idx = np.random.choice(n_samples, size=int(n_samples * 0.1), replace=False)
    y[noise_idx] = 1 - y[noise_idx]

    return X, y


def quick_train(n_samples: int = 1000, seed: int = 42) -> Dict[str, Any]:
    """
    Run quick training on sample data.

    Args:
        n_samples: Number of training samples
        seed: Random seed

    Returns:
        Training results with metrics
    """
    start_time = time.time()

    # Generate data
    X, y = generate_sample_data(n_samples, seed)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed
    )

    # Train simple model
    model = RandomForestClassifier(
        n_estimators=10,
        max_depth=5,
        random_state=seed,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "f1_score": f1_score(y_test, y_pred),
        "auc_roc": roc_auc_score(y_test, y_proba)
    }

    training_time = time.time() - start_time

    return {
        "model_type": "RandomForestClassifier",
        "n_samples": n_samples,
        "training_time_seconds": training_time,
        "metrics": metrics,
        "feature_importances": model.feature_importances_.tolist()
    }


if __name__ == "__main__":
    results = quick_train(n_samples=1000, seed=42)
    print(f"Quick Training Results:")
    print(f"  Accuracy: {results['metrics']['accuracy']:.4f}")
    print(f"  F1 Score: {results['metrics']['f1_score']:.4f}")
    print(f"  AUC-ROC:  {results['metrics']['auc_roc']:.4f}")
''',

        "mlflow_log_ci": '''"""
MLflow Logger - Log CI results to MLflow tracking server.
Creates experiment runs with parameters, metrics, and artifacts.
"""

import mlflow
from mlflow.tracking import MlflowClient
import os
from typing import Dict, Any, Optional


def setup_mlflow(tracking_uri: str = None, experiment_name: str = "claim-settlement-prediction"):
    """
    Setup MLflow tracking.

    Args:
        tracking_uri: MLflow server URI
        experiment_name: Experiment name
    """
    if tracking_uri:
        mlflow.set_tracking_uri(tracking_uri)

    mlflow.set_experiment(experiment_name)


def log_ci_run(
    commit_sha: str,
    metrics: Dict[str, float],
    params: Dict[str, Any],
    artifacts_dir: Optional[str] = None,
    tags: Optional[Dict[str, str]] = None
) -> str:
    """
    Log a CI run to MLflow.

    Args:
        commit_sha: Git commit SHA
        metrics: Dictionary of metrics
        params: Dictionary of parameters
        artifacts_dir: Optional directory of artifacts to log
        tags: Optional additional tags

    Returns:
        MLflow run ID
    """
    # Prepare tags
    run_tags = {
        "commit_sha": commit_sha,
        "stage": "ci",
        "mlflow.runName": f"CI-{commit_sha[:8]}"
    }
    if tags:
        run_tags.update(tags)

    with mlflow.start_run(tags=run_tags) as run:
        # Log parameters
        for key, value in params.items():
            mlflow.log_param(key, value)

        # Log metrics
        for key, value in metrics.items():
            mlflow.log_metric(key, value)

        # Log artifacts if provided
        if artifacts_dir and os.path.exists(artifacts_dir):
            mlflow.log_artifacts(artifacts_dir)

        return run.info.run_id


def get_experiment_runs(experiment_name: str, max_results: int = 10) -> list:
    """
    Get recent runs from an experiment.

    Args:
        experiment_name: Experiment name
        max_results: Maximum runs to return

    Returns:
        List of run info dictionaries
    """
    client = MlflowClient()
    experiment = mlflow.get_experiment_by_name(experiment_name)

    if not experiment:
        return []

    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        max_results=max_results,
        order_by=["start_time DESC"]
    )

    return [
        {
            "run_id": run.info.run_id,
            "run_name": run.info.run_name,
            "status": run.info.status,
            "metrics": dict(run.data.metrics),
            "params": dict(run.data.params),
            "tags": dict(run.data.tags)
        }
        for run in runs
    ]


if __name__ == "__main__":
    # Example usage
    setup_mlflow()

    run_id = log_ci_run(
        commit_sha="abc12345",
        metrics={"accuracy": 0.85, "f1_score": 0.82},
        params={"model_type": "RandomForest", "n_samples": 1000}
    )
    print(f"Logged CI run: {run_id}")
''',

        "cd_full_train": '''"""
CD Full Train - Full model training on complete dataset.
Trains the production-ready model with hyperparameter tuning.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score,
    precision_score, recall_score, confusion_matrix
)
import mlflow
import mlflow.sklearn
from typing import Dict, Any, Tuple
import time
import joblib


def generate_full_dataset(n_samples: int = 50000, seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate full synthetic claims dataset.

    Args:
        n_samples: Number of samples
        seed: Random seed

    Returns:
        Tuple of (features, labels)
    """
    np.random.seed(seed)

    # Generate features
    cpt_bucket = np.random.randint(0, 10, n_samples)
    provider_type = np.random.randint(0, 5, n_samples)
    billed_amount = np.random.exponential(500, n_samples)
    allowed_amount = billed_amount * np.random.uniform(0.6, 1.0, n_samples)
    diagnosis_group = np.random.randint(0, 20, n_samples)
    patient_age = np.random.randint(18, 85, n_samples)

    X = np.column_stack([
        cpt_bucket, provider_type, billed_amount,
        allowed_amount, diagnosis_group, patient_age
    ])

    # Generate target with realistic rules
    approval_prob = (
        0.3 +
        0.2 * (billed_amount < 500) +
        0.1 * (allowed_amount / billed_amount > 0.8) +
        0.1 * (diagnosis_group < 10) +
        0.1 * ((patient_age > 30) & (patient_age < 65))
    )
    approval_prob = np.clip(approval_prob, 0.1, 0.9)
    y = (np.random.random(n_samples) < approval_prob).astype(int)

    return X, y


def train_full_model(
    n_samples: int = 50000,
    seed: int = 42,
    log_to_mlflow: bool = True,
    commit_sha: str = None
) -> Dict[str, Any]:
    """
    Train full model with cross-validation.

    Args:
        n_samples: Number of training samples
        seed: Random seed
        log_to_mlflow: Whether to log to MLflow
        commit_sha: Git commit SHA for tagging

    Returns:
        Training results
    """
    start_time = time.time()

    # Generate data
    X, y = generate_full_dataset(n_samples, seed)

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed, stratify=y
    )

    # Define model with tuned hyperparameters
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=seed,
        n_jobs=-1
    )

    # Cross-validation
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='f1')

    # Final training
    model.fit(X_train, y_train)

    # Evaluation
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(y_test, y_pred),
        "f1_score": f1_score(y_test, y_pred),
        "auc_roc": roc_auc_score(y_test, y_proba),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "cv_f1_mean": cv_scores.mean(),
        "cv_f1_std": cv_scores.std()
    }

    training_time = time.time() - start_time

    # Log to MLflow
    if log_to_mlflow:
        with mlflow.start_run(
            run_name=f"CD-{commit_sha[:8] if commit_sha else 'full'}",
            tags={"stage": "cd", "commit_sha": commit_sha or "unknown"}
        ) as run:
            # Log parameters
            mlflow.log_params({
                "model_type": "RandomForestClassifier",
                "n_estimators": 100,
                "max_depth": 15,
                "n_samples": n_samples,
                "seed": seed
            })

            # Log metrics
            mlflow.log_metrics(metrics)

            # Log model
            mlflow.sklearn.log_model(model, "model")

            mlflow_run_id = run.info.run_id
    else:
        mlflow_run_id = None

    return {
        "model": model,
        "metrics": metrics,
        "training_time_seconds": training_time,
        "mlflow_run_id": mlflow_run_id,
        "feature_importances": dict(zip(
            ["cpt_bucket", "provider_type", "billed_amount",
             "allowed_amount", "diagnosis_group", "patient_age"],
            model.feature_importances_.tolist()
        ))
    }


if __name__ == "__main__":
    results = train_full_model(n_samples=50000, seed=42)
    print(f"Full Training Results:")
    for metric, value in results['metrics'].items():
        print(f"  {metric}: {value:.4f}")
''',

        "evaluate_vs_champion": '''"""
Evaluate vs Champion - Compare challenger model against champion.
Determines if new model should replace the current production model.
"""

import numpy as np
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
import mlflow
from mlflow.tracking import MlflowClient
from typing import Dict, Any, Optional, Tuple


# Minimum improvement threshold to promote challenger
IMPROVEMENT_THRESHOLD = 0.01  # 1% improvement required


def load_champion_model(model_name: str = "claim-settlement-model") -> Tuple[Any, Dict]:
    """
    Load the current champion (production) model.

    Args:
        model_name: Name of the registered model

    Returns:
        Tuple of (model, metrics)
    """
    client = MlflowClient()

    try:
        # Try to load production model
        model = mlflow.sklearn.load_model(f"models:/{model_name}/Production")

        # Get metrics from the run
        versions = client.get_latest_versions(model_name, stages=["Production"])
        if versions:
            run = client.get_run(versions[0].run_id)
            metrics = dict(run.data.metrics)
        else:
            metrics = {}

        return model, metrics

    except Exception as e:
        # No production model exists yet
        return None, {"f1_score": 0.0, "auc_roc": 0.0}


def evaluate_on_holdout(
    model,
    X_holdout: np.ndarray,
    y_holdout: np.ndarray
) -> Dict[str, float]:
    """
    Evaluate model on holdout set.

    Args:
        model: Trained model
        X_holdout: Holdout features
        y_holdout: Holdout labels

    Returns:
        Dictionary of metrics
    """
    y_pred = model.predict(X_holdout)
    y_proba = model.predict_proba(X_holdout)[:, 1]

    return {
        "accuracy": accuracy_score(y_holdout, y_pred),
        "f1_score": f1_score(y_holdout, y_pred),
        "auc_roc": roc_auc_score(y_holdout, y_proba)
    }


def compare_models(
    challenger_metrics: Dict[str, float],
    champion_metrics: Dict[str, float],
    primary_metric: str = "f1_score"
) -> Dict[str, Any]:
    """
    Compare challenger and champion models.

    Args:
        challenger_metrics: Challenger model metrics
        champion_metrics: Champion model metrics
        primary_metric: Metric to use for comparison

    Returns:
        Comparison results
    """
    challenger_score = challenger_metrics.get(primary_metric, 0)
    champion_score = champion_metrics.get(primary_metric, 0)

    improvement = challenger_score - champion_score
    improvement_pct = (improvement / champion_score * 100) if champion_score > 0 else 100

    challenger_wins = improvement >= IMPROVEMENT_THRESHOLD

    return {
        "challenger_metrics": challenger_metrics,
        "champion_metrics": champion_metrics,
        "primary_metric": primary_metric,
        "challenger_score": challenger_score,
        "champion_score": champion_score,
        "improvement": improvement,
        "improvement_pct": improvement_pct,
        "threshold": IMPROVEMENT_THRESHOLD,
        "challenger_wins": challenger_wins,
        "recommendation": "promote" if challenger_wins else "reject"
    }


def run_evaluation(
    challenger_run_id: str,
    holdout_size: int = 10000,
    seed: int = 42
) -> Dict[str, Any]:
    """
    Run full evaluation pipeline.

    Args:
        challenger_run_id: MLflow run ID of challenger
        holdout_size: Size of holdout set
        seed: Random seed

    Returns:
        Complete evaluation results
    """
    # Load challenger
    challenger_model = mlflow.sklearn.load_model(f"runs:/{challenger_run_id}/model")

    # Load champion
    champion_model, champion_metrics = load_champion_model()

    # Generate holdout data
    from ml.training.full_train import generate_full_dataset
    X_holdout, y_holdout = generate_full_dataset(holdout_size, seed + 1)

    # Evaluate challenger
    challenger_metrics = evaluate_on_holdout(challenger_model, X_holdout, y_holdout)

    # If no champion, challenger automatically wins
    if champion_model is None:
        return {
            "challenger_metrics": challenger_metrics,
            "champion_metrics": None,
            "challenger_wins": True,
            "recommendation": "promote",
            "reason": "No existing champion model"
        }

    # Compare
    comparison = compare_models(challenger_metrics, champion_metrics)

    return comparison


if __name__ == "__main__":
    # Example usage
    results = compare_models(
        challenger_metrics={"f1_score": 0.89, "auc_roc": 0.94},
        champion_metrics={"f1_score": 0.87, "auc_roc": 0.92}
    )
    print(f"Comparison Results:")
    print(f"  Challenger wins: {results['challenger_wins']}")
    print(f"  Improvement: {results['improvement_pct']:.2f}%")
''',

        "manual_approval": '''"""
Manual Approval Gate - Pause pipeline for human approval.
Provides context and metrics for human decision making.
"""

from typing import Dict, Any
from datetime import datetime


def prepare_approval_context(
    run_id: str,
    challenger_metrics: Dict[str, float],
    champion_metrics: Dict[str, float],
    comparison_results: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Prepare context for manual approval decision.

    Args:
        run_id: Pipeline run ID
        challenger_metrics: Challenger model metrics
        champion_metrics: Champion model metrics
        comparison_results: Model comparison results

    Returns:
        Approval context for display
    """
    return {
        "run_id": run_id,
        "timestamp": datetime.utcnow().isoformat(),
        "challenger": {
            "metrics": challenger_metrics,
            "recommendation": comparison_results.get("recommendation", "unknown")
        },
        "champion": {
            "metrics": champion_metrics
        },
        "comparison": {
            "improvement_pct": comparison_results.get("improvement_pct", 0),
            "challenger_wins": comparison_results.get("challenger_wins", False)
        },
        "approval_options": {
            "approve": "Proceed to deploy challenger to staging",
            "reject": "Reject challenger, keep current champion"
        },
        "considerations": [
            "Review metrics improvement carefully",
            "Check for potential overfitting",
            "Consider business impact of model change",
            "Verify no data quality issues"
        ]
    }


def wait_for_approval(run_id: str, timeout_minutes: int = 60) -> Dict[str, Any]:
    """
    Wait for manual approval (implemented via API callback).

    Args:
        run_id: Pipeline run ID
        timeout_minutes: Maximum wait time

    Returns:
        Approval result (implemented externally)
    """
    # This is a placeholder - actual approval happens via API
    return {
        "status": "waiting",
        "message": "Waiting for manual approval via UI",
        "timeout_minutes": timeout_minutes
    }


if __name__ == "__main__":
    # Example context preparation
    context = prepare_approval_context(
        run_id="run_123",
        challenger_metrics={"f1_score": 0.89},
        champion_metrics={"f1_score": 0.87},
        comparison_results={"improvement_pct": 2.3, "challenger_wins": True}
    )
    print(f"Approval Context: {context}")
''',

        "deploy_staging": '''"""
Deploy to Staging - Deploy model to staging environment.
Prepares model for shadow testing before production.
"""

import os
from datetime import datetime
from typing import Dict, Any
import mlflow
from mlflow.tracking import MlflowClient


def deploy_to_staging(
    model_run_id: str,
    model_name: str = "claim-settlement-model",
    version: str = None
) -> Dict[str, Any]:
    """
    Deploy model to staging environment.

    Args:
        model_run_id: MLflow run ID containing the model
        model_name: Name in model registry
        version: Optional version string

    Returns:
        Deployment result
    """
    client = MlflowClient()
    version = version or datetime.utcnow().strftime("%Y%m%d%H%M%S")

    # Register model if not already registered
    model_uri = f"runs:/{model_run_id}/model"

    try:
        result = mlflow.register_model(model_uri, model_name)
        model_version = result.version
    except Exception as e:
        # Model already registered, get latest version
        versions = client.search_model_versions(f"name='{model_name}'")
        model_version = max([int(v.version) for v in versions]) if versions else "1"

    # Transition to staging
    client.transition_model_version_stage(
        name=model_name,
        version=str(model_version),
        stage="Staging",
        archive_existing_versions=True
    )

    return {
        "success": True,
        "environment": "staging",
        "model_name": model_name,
        "model_version": model_version,
        "mlflow_run_id": model_run_id,
        "deployed_at": datetime.utcnow().isoformat(),
        "status": "active"
    }


def create_deployment_record(deployment_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a deployment record for tracking.

    Args:
        deployment_info: Deployment information

    Returns:
        Deployment record
    """
    return {
        **deployment_info,
        "health_check_url": "/health",
        "metrics_url": "/metrics",
        "rollback_available": True
    }


if __name__ == "__main__":
    # Example usage
    result = deploy_to_staging(
        model_run_id="abc123",
        model_name="claim-settlement-model"
    )
    print(f"Deployment Result: {result}")
''',

        "shadow_monitor": '''"""
Shadow Monitor - Run shadow scoring and monitor drift.
Tests model on live traffic without affecting production.
"""

import numpy as np
from scipy import stats
from typing import Dict, Any, List
from datetime import datetime


def calculate_psi(expected: np.ndarray, actual: np.ndarray, bins: int = 10) -> float:
    """
    Calculate Population Stability Index (PSI) for drift detection.

    Args:
        expected: Expected (training) distribution
        actual: Actual (production) distribution
        bins: Number of bins for bucketing

    Returns:
        PSI value (>0.2 indicates significant drift)
    """
    # Create bins based on expected distribution
    breakpoints = np.percentile(expected, np.linspace(0, 100, bins + 1))
    breakpoints[0] = -np.inf
    breakpoints[-1] = np.inf

    # Calculate proportions
    expected_counts = np.histogram(expected, bins=breakpoints)[0]
    actual_counts = np.histogram(actual, bins=breakpoints)[0]

    expected_pct = expected_counts / len(expected) + 0.0001
    actual_pct = actual_counts / len(actual) + 0.0001

    # PSI formula
    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))

    return psi


def run_shadow_scoring(
    model,
    stream_data: np.ndarray,
    stream_labels: np.ndarray = None,
    training_data: np.ndarray = None
) -> Dict[str, Any]:
    """
    Run shadow scoring on streaming data.

    Args:
        model: Model to score
        stream_data: Stream features
        stream_labels: Optional ground truth labels
        training_data: Training data for drift comparison

    Returns:
        Shadow scoring results
    """
    # Score stream data
    predictions = model.predict(stream_data)
    probabilities = model.predict_proba(stream_data)[:, 1]

    results = {
        "samples_scored": len(stream_data),
        "prediction_distribution": {
            "approved": int(predictions.sum()),
            "denied": int(len(predictions) - predictions.sum())
        },
        "probability_stats": {
            "mean": float(probabilities.mean()),
            "std": float(probabilities.std()),
            "min": float(probabilities.min()),
            "max": float(probabilities.max())
        }
    }

    # Calculate accuracy if labels available
    if stream_labels is not None:
        from sklearn.metrics import accuracy_score, f1_score
        results["accuracy"] = float(accuracy_score(stream_labels, predictions))
        results["f1_score"] = float(f1_score(stream_labels, predictions))

    # Calculate drift if training data available
    if training_data is not None:
        drift_metrics = {}
        for i in range(min(training_data.shape[1], stream_data.shape[1])):
            psi = calculate_psi(training_data[:, i], stream_data[:, i])
            drift_metrics[f"feature_{i}_psi"] = float(psi)

        results["drift_metrics"] = drift_metrics
        results["max_psi"] = max(drift_metrics.values())
        results["drift_detected"] = results["max_psi"] > 0.2

    return results


def monitor_batches(
    model,
    batch_generator,
    n_batches: int = 5,
    training_data: np.ndarray = None
) -> List[Dict[str, Any]]:
    """
    Monitor multiple batches of streaming data.

    Args:
        model: Model to monitor
        batch_generator: Generator yielding data batches
        n_batches: Number of batches to process
        training_data: Training data for drift comparison

    Returns:
        List of batch results
    """
    results = []

    for i, (X_batch, y_batch) in enumerate(batch_generator):
        if i >= n_batches:
            break

        batch_result = run_shadow_scoring(
            model, X_batch, y_batch, training_data
        )
        batch_result["batch_number"] = i + 1
        batch_result["timestamp"] = datetime.utcnow().isoformat()

        results.append(batch_result)

    return results


if __name__ == "__main__":
    # Example with synthetic data
    np.random.seed(42)

    expected = np.random.normal(100, 15, 1000)
    actual = np.random.normal(105, 18, 1000)  # Slight drift

    psi = calculate_psi(expected, actual)
    print(f"PSI: {psi:.4f} (>0.2 = significant drift)")
''',

        "promote_prod": '''"""
Promote to Production - Promote model from staging to production.
Makes the model the new champion serving live traffic.
"""

from datetime import datetime
from typing import Dict, Any
import mlflow
from mlflow.tracking import MlflowClient


def promote_to_production(
    model_name: str = "claim-settlement-model",
    version: str = None
) -> Dict[str, Any]:
    """
    Promote model from staging to production.

    Args:
        model_name: Name in model registry
        version: Specific version to promote (latest staging if None)

    Returns:
        Promotion result
    """
    client = MlflowClient()

    # Get staging version if not specified
    if version is None:
        staging_versions = client.get_latest_versions(model_name, stages=["Staging"])
        if not staging_versions:
            return {
                "success": False,
                "error": "No staging version found to promote"
            }
        version = staging_versions[0].version

    # Archive current production
    prod_versions = client.get_latest_versions(model_name, stages=["Production"])
    for v in prod_versions:
        client.transition_model_version_stage(
            name=model_name,
            version=v.version,
            stage="Archived"
        )

    # Promote to production
    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage="Production"
    )

    return {
        "success": True,
        "model_name": model_name,
        "version": version,
        "stage": "Production",
        "promoted_at": datetime.utcnow().isoformat(),
        "previous_versions_archived": len(prod_versions)
    }


def update_deployment_config(
    model_name: str,
    version: str,
    endpoint_url: str = None
) -> Dict[str, Any]:
    """
    Update deployment configuration files.

    Args:
        model_name: Model name
        version: Model version
        endpoint_url: Optional endpoint URL

    Returns:
        Configuration update result
    """
    config = {
        "model_name": model_name,
        "version": version,
        "deployed_at": datetime.utcnow().isoformat(),
        "endpoint": endpoint_url or "/api/v1/predict",
        "active": True
    }

    # In production, would write to config file or update service
    return {
        "config_updated": True,
        "config": config
    }


if __name__ == "__main__":
    # Example usage
    result = promote_to_production(
        model_name="claim-settlement-model"
    )
    print(f"Promotion Result: {result}")
''',

        "rollback": '''"""
Rollback - Rollback to previous production model version.
Emergency procedure to restore previous stable model.
"""

from datetime import datetime
from typing import Dict, Any, Optional
import mlflow
from mlflow.tracking import MlflowClient


def get_rollback_candidates(
    model_name: str = "claim-settlement-model",
    limit: int = 5
) -> list:
    """
    Get list of versions available for rollback.

    Args:
        model_name: Name in model registry
        limit: Maximum candidates to return

    Returns:
        List of rollback candidates
    """
    client = MlflowClient()

    # Get archived versions
    versions = client.search_model_versions(f"name='{model_name}'")

    candidates = [
        {
            "version": v.version,
            "stage": v.current_stage,
            "run_id": v.run_id,
            "creation_timestamp": v.creation_timestamp
        }
        for v in versions
        if v.current_stage in ["Archived", "Production"]
    ]

    # Sort by creation time descending
    candidates.sort(key=lambda x: x["creation_timestamp"], reverse=True)

    return candidates[:limit]


def rollback_to_version(
    model_name: str = "claim-settlement-model",
    target_version: str = None
) -> Dict[str, Any]:
    """
    Rollback to a specific version or previous version.

    Args:
        model_name: Name in model registry
        target_version: Version to rollback to (previous if None)

    Returns:
        Rollback result
    """
    client = MlflowClient()

    # Get current production
    prod_versions = client.get_latest_versions(model_name, stages=["Production"])
    if not prod_versions:
        return {"success": False, "error": "No production version to rollback from"}

    current_version = prod_versions[0].version

    # Find target version
    if target_version is None:
        # Get most recent archived version
        archived = client.get_latest_versions(model_name, stages=["Archived"])
        if not archived:
            return {"success": False, "error": "No archived version to rollback to"}
        target_version = archived[0].version

    # Archive current production
    client.transition_model_version_stage(
        name=model_name,
        version=current_version,
        stage="Archived"
    )

    # Restore target to production
    client.transition_model_version_stage(
        name=model_name,
        version=target_version,
        stage="Production"
    )

    return {
        "success": True,
        "model_name": model_name,
        "rolled_back_from": current_version,
        "rolled_back_to": target_version,
        "timestamp": datetime.utcnow().isoformat()
    }


def log_rollback_event(
    rollback_result: Dict[str, Any],
    reason: str = "Manual rollback"
) -> str:
    """
    Log rollback event to MLflow.

    Args:
        rollback_result: Result from rollback operation
        reason: Reason for rollback

    Returns:
        MLflow run ID
    """
    with mlflow.start_run(run_name="rollback-event") as run:
        mlflow.log_params({
            "event_type": "rollback",
            "from_version": rollback_result.get("rolled_back_from"),
            "to_version": rollback_result.get("rolled_back_to"),
            "reason": reason
        })

        mlflow.set_tag("rollback", "true")

        return run.info.run_id


if __name__ == "__main__":
    # Example: list rollback candidates
    candidates = get_rollback_candidates()
    print(f"Rollback Candidates: {candidates}")
'''
    }

    return templates.get(step_name, f"# Code for step: {step_name}\\n# Not yet implemented")


def get_template_config(step_name: str) -> dict:
    """Return template configuration for a step."""

    configs = {
        "commit_received": {
            "trigger": {
                "events": ["push", "pull_request"],
                "branches": ["main", "develop"]
            },
            "validation": {
                "require_signed_commits": False,
                "require_ci_pass": True
            }
        },
        "ci_tests": {
            "test_suites": [
                {"name": "unit_tests", "path": "tests/unit", "timeout": 300},
                {"name": "integration_tests", "path": "tests/integration", "timeout": 600}
            ],
            "linting": {
                "enabled": True,
                "tools": ["flake8", "black"]
            },
            "coverage": {
                "minimum": 80,
                "fail_under": True
            }
        },
        "data_validation": {
            "schema": {
                "required_columns": [
                    "claim_id", "cpt_bucket", "provider_type",
                    "billed_amount", "allowed_amount", "diagnosis_group",
                    "patient_age", "settlement_outcome"
                ]
            },
            "quality_checks": {
                "null_threshold": 0.05,
                "duplicate_check": True,
                "range_validation": True
            }
        },
        "ci_quick_train": {
            "training": {
                "sample_size": 1000,
                "model_type": "RandomForestClassifier",
                "hyperparameters": {
                    "n_estimators": 10,
                    "max_depth": 5
                }
            },
            "validation": {
                "test_split": 0.2,
                "metrics": ["accuracy", "f1_score", "auc_roc"]
            },
            "seed": 42
        },
        "mlflow": {
            "tracking_uri": "${MLFLOW_TRACKING_URI}",
            "experiment_name": "claim-settlement-prediction",
            "artifact_location": "s3://mlflow-artifacts/",
            "tags": {
                "project": "claim-ml-cicd-lab",
                "team": "data-science"
            }
        },
        "full_train": {
            "training": {
                "sample_size": 50000,
                "model_type": "RandomForestClassifier",
                "hyperparameters": {
                    "n_estimators": 100,
                    "max_depth": 15,
                    "min_samples_split": 10,
                    "min_samples_leaf": 5
                },
                "cross_validation": {
                    "enabled": True,
                    "folds": 5
                }
            },
            "feature_engineering": {
                "enabled": True,
                "scaling": "standard"
            },
            "seed": 42
        },
        "evaluation": {
            "champion_comparison": {
                "primary_metric": "f1_score",
                "improvement_threshold": 0.01,
                "holdout_size": 10000
            },
            "metrics": ["accuracy", "f1_score", "auc_roc", "precision", "recall"]
        },
        "approval": {
            "required_approvers": 1,
            "timeout_hours": 24,
            "auto_reject_on_timeout": False,
            "notification": {
                "slack": True,
                "email": True
            }
        },
        "deploy_staging": {
            "environment": "staging",
            "health_check": {
                "enabled": True,
                "endpoint": "/health",
                "timeout": 30
            },
            "canary": {
                "enabled": False,
                "percentage": 10
            }
        },
        "shadow_monitor": {
            "monitoring": {
                "duration_minutes": 30,
                "sample_rate": 0.1,
                "metrics_interval": 60
            },
            "drift_detection": {
                "enabled": True,
                "psi_threshold": 0.2,
                "alert_on_drift": True
            },
            "performance": {
                "accuracy_threshold": 0.85,
                "latency_threshold_ms": 100
            }
        },
        "deploy_prod": {
            "environment": "production",
            "rollout": {
                "strategy": "blue_green",
                "auto_rollback": True,
                "health_check_retries": 3
            },
            "notification": {
                "on_success": True,
                "on_failure": True
            }
        },
        "rollback": {
            "strategy": "immediate",
            "keep_versions": 5,
            "notification": {
                "required": True,
                "channels": ["slack", "pagerduty"]
            }
        }
    }

    return configs.get(step_name, {"step": step_name, "config": "default"})
