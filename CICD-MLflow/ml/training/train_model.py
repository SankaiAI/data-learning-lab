"""
Main Training Script for Claim Settlement Prediction Model.

This script handles the full training pipeline including:
- Data generation (synthetic claims)
- Feature engineering
- Model training with cross-validation
- Evaluation and metrics calculation
- SHAP analysis for interpretability
- MLflow logging

Usage:
    python train_model.py --mode ci --samples 1000 --seed 42
    python train_model.py --mode cd --samples 50000 --seed 42
"""

import argparse
import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
import logging
import joblib
import json

# ML imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, precision_score,
    recall_score, confusion_matrix, classification_report
)
from sklearn.preprocessing import StandardScaler

# Visualization
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

# MLflow
import mlflow
import mlflow.sklearn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Feature names for claims data
FEATURE_NAMES = [
    'cpt_bucket',
    'provider_type',
    'billed_amount',
    'allowed_amount',
    'diagnosis_group',
    'patient_age'
]


def generate_synthetic_claims(n_samples: int, seed: int = 42) -> tuple:
    """
    Generate synthetic claims data for training.

    Args:
        n_samples: Number of samples to generate
        seed: Random seed for reproducibility

    Returns:
        Tuple of (features DataFrame, labels Series)
    """
    np.random.seed(seed)
    logger.info(f"Generating {n_samples} synthetic claims with seed {seed}")

    # Generate features
    data = {
        'cpt_bucket': np.random.randint(0, 10, n_samples),
        'provider_type': np.random.randint(0, 5, n_samples),
        'billed_amount': np.random.exponential(500, n_samples) + 50,
        'diagnosis_group': np.random.randint(0, 20, n_samples),
        'patient_age': np.random.randint(0, 95, n_samples)
    }

    # Allowed amount is correlated with billed amount
    data['allowed_amount'] = data['billed_amount'] * np.random.uniform(0.5, 1.0, n_samples)

    df = pd.DataFrame(data)

    # Generate target (settlement outcome) based on rules + noise
    approval_prob = (
        0.5 +
        0.15 * (df['billed_amount'] < 500).astype(float) +
        0.1 * (df['allowed_amount'] / df['billed_amount'] > 0.8).astype(float) +
        0.1 * (df['diagnosis_group'] < 10).astype(float) +
        0.1 * ((df['patient_age'] > 30) & (df['patient_age'] < 65)).astype(float) +
        0.05 * (df['provider_type'] < 2).astype(float)
    )

    # Add noise
    approval_prob = np.clip(approval_prob, 0.1, 0.9)
    y = (np.random.random(n_samples) < approval_prob).astype(int)

    logger.info(f"Generated data: {n_samples} samples, "
                f"approval rate: {y.mean():.2%}")

    return df, pd.Series(y, name='settlement_outcome')


def train_model(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    mode: str = 'ci'
) -> RandomForestClassifier:
    """
    Train a Random Forest classifier.

    Args:
        X_train: Training features
        y_train: Training labels
        mode: Training mode ('ci' for quick, 'cd' for full)

    Returns:
        Trained model
    """
    # Hyperparameters based on mode
    if mode == 'ci':
        params = {
            'n_estimators': 10,
            'max_depth': 5,
            'min_samples_split': 10,
            'n_jobs': -1,
            'random_state': 42
        }
    else:  # cd mode - full training
        params = {
            'n_estimators': 100,
            'max_depth': 15,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
            'n_jobs': -1,
            'random_state': 42
        }

    logger.info(f"Training RandomForest with params: {params}")

    model = RandomForestClassifier(**params)
    model.fit(X_train, y_train)

    return model


def evaluate_model(
    model: RandomForestClassifier,
    X_test: pd.DataFrame,
    y_test: pd.Series
) -> dict:
    """
    Evaluate model performance.

    Args:
        model: Trained model
        X_test: Test features
        y_test: Test labels

    Returns:
        Dictionary of metrics
    """
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        'accuracy': accuracy_score(y_test, y_pred),
        'f1_score': f1_score(y_test, y_pred),
        'auc_roc': roc_auc_score(y_test, y_proba),
        'precision': precision_score(y_test, y_pred),
        'recall': recall_score(y_test, y_pred)
    }

    logger.info("Evaluation metrics:")
    for name, value in metrics.items():
        logger.info(f"  {name}: {value:.4f}")

    return metrics


def create_plots(
    model: RandomForestClassifier,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    output_dir: str
) -> list:
    """
    Create evaluation plots.

    Args:
        model: Trained model
        X_test: Test features
        y_test: Test labels
        output_dir: Directory to save plots

    Returns:
        List of plot file paths
    """
    os.makedirs(output_dir, exist_ok=True)
    plots = []

    # 1. Feature Importance Plot
    fig, ax = plt.subplots(figsize=(10, 6))
    importance_df = pd.DataFrame({
        'feature': FEATURE_NAMES,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=True)

    ax.barh(importance_df['feature'], importance_df['importance'])
    ax.set_xlabel('Importance')
    ax.set_title('Feature Importance')
    plt.tight_layout()

    importance_path = os.path.join(output_dir, 'feature_importance.png')
    plt.savefig(importance_path, dpi=150)
    plt.close()
    plots.append(importance_path)
    logger.info(f"Saved feature importance plot: {importance_path}")

    # 2. Confusion Matrix
    y_pred = model.predict(X_test)
    cm = confusion_matrix(y_test, y_pred)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=ax)
    ax.set_xlabel('Predicted')
    ax.set_ylabel('Actual')
    ax.set_title('Confusion Matrix')
    ax.set_xticklabels(['Denied', 'Approved'])
    ax.set_yticklabels(['Denied', 'Approved'])
    plt.tight_layout()

    cm_path = os.path.join(output_dir, 'confusion_matrix.png')
    plt.savefig(cm_path, dpi=150)
    plt.close()
    plots.append(cm_path)
    logger.info(f"Saved confusion matrix: {cm_path}")

    # 3. SHAP Summary Plot (if shap is available)
    try:
        import shap

        explainer = shap.TreeExplainer(model)
        # Use a subset for SHAP (can be slow)
        X_sample = X_test.head(min(500, len(X_test)))
        shap_values = explainer.shap_values(X_sample)

        fig, ax = plt.subplots(figsize=(10, 6))
        shap.summary_plot(
            shap_values[1],  # For positive class
            X_sample,
            feature_names=FEATURE_NAMES,
            show=False
        )
        plt.tight_layout()

        shap_path = os.path.join(output_dir, 'shap_summary.png')
        plt.savefig(shap_path, dpi=150, bbox_inches='tight')
        plt.close()
        plots.append(shap_path)
        logger.info(f"Saved SHAP summary plot: {shap_path}")

    except ImportError:
        logger.warning("SHAP not available, skipping SHAP plot")
    except Exception as e:
        logger.warning(f"Could not create SHAP plot: {e}")

    return plots


def create_model_card(
    model: RandomForestClassifier,
    metrics: dict,
    params: dict,
    output_dir: str
) -> str:
    """
    Create a model card markdown file.

    Args:
        model: Trained model
        metrics: Evaluation metrics
        params: Training parameters
        output_dir: Directory to save model card

    Returns:
        Path to model card file
    """
    os.makedirs(output_dir, exist_ok=True)

    card_content = f"""# Claim Settlement Prediction Model

## Model Overview
- **Model Type**: Random Forest Classifier
- **Training Date**: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC
- **Framework**: scikit-learn

## Intended Use
This model predicts whether a medical claim will be approved or denied based on
claim characteristics including CPT bucket, provider type, billed amount, and
patient demographics.

## Training Data
- **Source**: Synthetic claims data (non-PHI)
- **Samples**: {params.get('n_samples', 'N/A')}
- **Features**: {', '.join(FEATURE_NAMES)}
- **Target**: Settlement outcome (0=Denied, 1=Approved)

## Model Parameters
```json
{json.dumps(params, indent=2)}
```

## Performance Metrics
| Metric | Value |
|--------|-------|
| Accuracy | {metrics.get('accuracy', 0):.4f} |
| F1 Score | {metrics.get('f1_score', 0):.4f} |
| AUC-ROC | {metrics.get('auc_roc', 0):.4f} |
| Precision | {metrics.get('precision', 0):.4f} |
| Recall | {metrics.get('recall', 0):.4f} |

## Feature Importance
1. **billed_amount**: Primary predictor based on claim value
2. **allowed_amount**: Correlation with approval likelihood
3. **diagnosis_group**: Certain diagnosis groups have higher approval rates
4. **patient_age**: Age-related patterns in approvals
5. **provider_type**: Provider type influences outcomes
6. **cpt_bucket**: CPT code category impact

## Limitations
- Trained on synthetic data; may not generalize to real claims
- Does not account for temporal patterns or seasonality
- Limited feature set compared to production models

## Ethical Considerations
- Model should not be used as sole decision-maker for claim adjudication
- Regular monitoring for demographic bias is recommended
- Decisions should be reviewable by human experts

## Version Info
- **Commit SHA**: {params.get('commit_sha', 'N/A')}
- **Stage**: {params.get('stage', 'N/A')}
- **Seed**: {params.get('seed', 42)}
"""

    card_path = os.path.join(output_dir, 'model_card.md')
    with open(card_path, 'w') as f:
        f.write(card_content)

    logger.info(f"Saved model card: {card_path}")
    return card_path


def run_training(
    mode: str,
    n_samples: int,
    seed: int,
    commit_sha: str,
    output_dir: str,
    log_to_mlflow: bool = True
) -> dict:
    """
    Run the full training pipeline.

    Args:
        mode: Training mode ('ci' or 'cd')
        n_samples: Number of training samples
        seed: Random seed
        commit_sha: Git commit SHA for tracking
        output_dir: Directory for outputs
        log_to_mlflow: Whether to log to MLflow

    Returns:
        Dictionary with training results
    """
    logger.info(f"Starting {mode.upper()} training pipeline")
    logger.info(f"Samples: {n_samples}, Seed: {seed}, Commit: {commit_sha}")

    # Generate data
    X, y = generate_synthetic_claims(n_samples, seed)

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=seed, stratify=y
    )

    # Cross-validation (for CD mode)
    if mode == 'cd':
        logger.info("Running cross-validation...")
        temp_model = RandomForestClassifier(
            n_estimators=10, max_depth=5, random_state=seed, n_jobs=-1
        )
        cv_scores = cross_val_score(temp_model, X_train, y_train, cv=5, scoring='f1')
        logger.info(f"CV F1 scores: {cv_scores}")
        logger.info(f"CV F1 mean: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

    # Train model
    model = train_model(X_train, y_train, mode)

    # Evaluate
    metrics = evaluate_model(model, X_test, y_test)

    # Create artifacts directory
    artifacts_dir = os.path.join(output_dir, 'artifacts')
    os.makedirs(artifacts_dir, exist_ok=True)

    # Create plots
    plots = create_plots(model, X_test, y_test, artifacts_dir)

    # Create model card
    params = {
        'n_samples': n_samples,
        'seed': seed,
        'commit_sha': commit_sha,
        'stage': mode,
        'model_type': 'RandomForestClassifier',
        'n_estimators': model.n_estimators,
        'max_depth': model.max_depth
    }
    model_card_path = create_model_card(model, metrics, params, artifacts_dir)

    # Save model locally
    model_path = os.path.join(artifacts_dir, 'model.joblib')
    joblib.dump(model, model_path)
    logger.info(f"Saved model: {model_path}")

    # Log to MLflow
    mlflow_run_id = None
    if log_to_mlflow:
        try:
            with mlflow.start_run(
                run_name=f"{mode.upper()}-{commit_sha[:8]}",
                tags={
                    'stage': mode,
                    'commit_sha': commit_sha,
                    'dataset_window': f"{n_samples}_samples",
                    'seed': str(seed)
                }
            ) as run:
                # Log parameters
                mlflow.log_params(params)

                # Log metrics
                mlflow.log_metrics(metrics)

                # Log artifacts
                mlflow.log_artifacts(artifacts_dir)

                # Log model
                mlflow.sklearn.log_model(
                    model,
                    "model",
                    registered_model_name="claim-settlement-model" if mode == 'cd' else None
                )

                mlflow_run_id = run.info.run_id
                logger.info(f"Logged to MLflow run: {mlflow_run_id}")

        except Exception as e:
            logger.error(f"Failed to log to MLflow: {e}")

    return {
        'mode': mode,
        'metrics': metrics,
        'model_path': model_path,
        'artifacts_dir': artifacts_dir,
        'mlflow_run_id': mlflow_run_id,
        'plots': plots
    }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Train Claim Settlement Model')
    parser.add_argument('--mode', choices=['ci', 'cd'], default='ci',
                        help='Training mode: ci (quick) or cd (full)')
    parser.add_argument('--samples', type=int, default=1000,
                        help='Number of training samples')
    parser.add_argument('--seed', type=int, default=42,
                        help='Random seed for reproducibility')
    parser.add_argument('--commit', type=str, default='local',
                        help='Git commit SHA')
    parser.add_argument('--output-dir', type=str, default='./output',
                        help='Output directory')
    parser.add_argument('--no-mlflow', action='store_true',
                        help='Disable MLflow logging')

    args = parser.parse_args()

    result = run_training(
        mode=args.mode,
        n_samples=args.samples,
        seed=args.seed,
        commit_sha=args.commit,
        output_dir=args.output_dir,
        log_to_mlflow=not args.no_mlflow
    )

    logger.info("Training complete!")
    logger.info(f"Results: {json.dumps(result['metrics'], indent=2)}")


if __name__ == '__main__':
    main()
