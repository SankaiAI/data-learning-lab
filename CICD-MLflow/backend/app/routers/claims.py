"""
Claims API router.
Handles synthetic claims generation and streaming.
"""

from fastapi import APIRouter, Request, BackgroundTasks
from typing import Optional
import asyncio
import numpy as np
from datetime import datetime, timedelta
import random
import string

router = APIRouter()

# Synthetic data constants
CPT_BUCKETS = [
    "Evaluation & Management",
    "Surgery",
    "Radiology",
    "Laboratory",
    "Medicine",
    "Anesthesia",
    "Physical Therapy",
    "Mental Health",
    "Preventive Care",
    "Emergency"
]

PROVIDER_TYPES = [
    "Hospital",
    "Physician Office",
    "Outpatient Clinic",
    "Urgent Care",
    "Telehealth"
]

DIAGNOSIS_GROUPS = [
    "Cardiovascular",
    "Respiratory",
    "Musculoskeletal",
    "Neurological",
    "Gastrointestinal",
    "Endocrine",
    "Mental Health",
    "Infectious Disease",
    "Oncology",
    "Dermatology",
    "Ophthalmology",
    "Dental",
    "Pediatric",
    "Geriatric",
    "Preventive",
    "Emergency",
    "Chronic Pain",
    "Substance Abuse",
    "Pregnancy",
    "Other"
]

# Active streaming state
streaming_active = False
streaming_task = None


def generate_claim_id() -> str:
    """Generate a unique claim ID."""
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CLM-{timestamp}-{random_suffix}"


def generate_synthetic_claim(seed: Optional[int] = None) -> dict:
    """
    Generate a single synthetic claim.

    Args:
        seed: Optional random seed

    Returns:
        Synthetic claim dictionary
    """
    if seed:
        np.random.seed(seed)

    # Generate claim attributes
    cpt_bucket = random.choice(CPT_BUCKETS)
    provider_type = random.choice(PROVIDER_TYPES)
    diagnosis_group = random.choice(DIAGNOSIS_GROUPS)

    # Generate amounts with realistic distributions
    billed_amount = round(np.random.exponential(500) + 50, 2)
    allowed_ratio = np.random.uniform(0.5, 1.0)
    allowed_amount = round(billed_amount * allowed_ratio, 2)

    # Patient demographics
    patient_age = np.random.randint(0, 95)

    # Service date (within last 90 days)
    days_ago = np.random.randint(0, 90)
    service_date = (datetime.utcnow() - timedelta(days=days_ago)).strftime("%Y-%m-%d")

    # Calculate settlement probability based on rules
    settlement_prob = 0.7  # Base probability

    # Adjust based on factors
    if billed_amount > 1000:
        settlement_prob -= 0.1
    if allowed_ratio < 0.7:
        settlement_prob -= 0.15
    if diagnosis_group in ["Oncology", "Mental Health", "Chronic Pain"]:
        settlement_prob -= 0.1
    if provider_type == "Hospital":
        settlement_prob += 0.05
    if patient_age > 65:
        settlement_prob += 0.05

    settlement_prob = max(0.1, min(0.95, settlement_prob))
    settlement_outcome = 1 if random.random() < settlement_prob else 0

    return {
        "claim_id": generate_claim_id(),
        "timestamp": datetime.utcnow().isoformat(),
        "cpt_bucket": cpt_bucket,
        "cpt_bucket_idx": CPT_BUCKETS.index(cpt_bucket),
        "provider_type": provider_type,
        "provider_type_idx": PROVIDER_TYPES.index(provider_type),
        "billed_amount": billed_amount,
        "allowed_amount": allowed_amount,
        "allowed_ratio": round(allowed_ratio, 3),
        "diagnosis_group": diagnosis_group,
        "diagnosis_group_idx": DIAGNOSIS_GROUPS.index(diagnosis_group),
        "patient_age": int(patient_age),
        "service_date": service_date,
        "settlement_outcome": settlement_outcome,
        "settlement_label": "Approved" if settlement_outcome == 1 else "Denied"
    }


def generate_claims_batch(n: int = 10, seed: Optional[int] = None) -> list:
    """
    Generate a batch of synthetic claims.

    Args:
        n: Number of claims to generate
        seed: Optional random seed

    Returns:
        List of synthetic claims
    """
    if seed:
        np.random.seed(seed)

    return [generate_synthetic_claim() for _ in range(n)]


def generate_training_dataset(
    n_samples: int = 10000,
    seed: int = 42,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """
    Generate a training dataset with specified parameters.

    Args:
        n_samples: Number of samples
        seed: Random seed for reproducibility
        start_date: Dataset window start
        end_date: Dataset window end

    Returns:
        Dataset info dictionary
    """
    np.random.seed(seed)

    claims = generate_claims_batch(n_samples, seed)

    # Calculate statistics
    approved = sum(1 for c in claims if c["settlement_outcome"] == 1)
    denied = n_samples - approved

    # Feature distributions
    billed_amounts = [c["billed_amount"] for c in claims]
    ages = [c["patient_age"] for c in claims]

    return {
        "n_samples": n_samples,
        "seed": seed,
        "start_date": start_date or (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d"),
        "end_date": end_date or datetime.utcnow().strftime("%Y-%m-%d"),
        "statistics": {
            "approved": approved,
            "denied": denied,
            "approval_rate": round(approved / n_samples, 3),
            "mean_billed_amount": round(np.mean(billed_amounts), 2),
            "std_billed_amount": round(np.std(billed_amounts), 2),
            "mean_age": round(np.mean(ages), 1),
            "cpt_distribution": {
                bucket: sum(1 for c in claims if c["cpt_bucket"] == bucket)
                for bucket in CPT_BUCKETS
            }
        },
        "sample_claims": claims[:5]  # Include a few sample claims
    }


def calculate_drift_metrics(
    current_batch: list,
    reference_stats: dict
) -> dict:
    """
    Calculate drift metrics comparing current batch to reference.

    Args:
        current_batch: Current claims batch
        reference_stats: Reference statistics from training

    Returns:
        Drift metrics dictionary
    """
    if not current_batch:
        return {"error": "Empty batch"}

    # Current statistics
    current_billed = [c["billed_amount"] for c in current_batch]
    current_ages = [c["patient_age"] for c in current_batch]
    current_approval = sum(1 for c in current_batch if c["settlement_outcome"] == 1) / len(current_batch)

    # Calculate PSI-like drift metric (simplified)
    ref_mean_billed = reference_stats.get("mean_billed_amount", 500)
    ref_approval = reference_stats.get("approval_rate", 0.7)

    billed_drift = abs(np.mean(current_billed) - ref_mean_billed) / ref_mean_billed
    approval_drift = abs(current_approval - ref_approval)

    # Combined PSI approximation
    psi = billed_drift * 0.5 + approval_drift * 0.5

    return {
        "psi": round(psi, 4),
        "drift_detected": psi > 0.2,
        "metrics": {
            "billed_amount": {
                "current_mean": round(np.mean(current_billed), 2),
                "reference_mean": ref_mean_billed,
                "drift": round(billed_drift, 4)
            },
            "approval_rate": {
                "current": round(current_approval, 3),
                "reference": ref_approval,
                "drift": round(approval_drift, 4)
            },
            "age": {
                "current_mean": round(np.mean(current_ages), 1)
            }
        },
        "sample_size": len(current_batch),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/generate")
async def generate_claims(n: int = 10, seed: Optional[int] = None):
    """
    Generate synthetic claims.

    Args:
        n: Number of claims to generate
        seed: Optional random seed

    Returns:
        List of synthetic claims
    """
    claims = generate_claims_batch(n, seed)
    return {"claims": claims, "count": len(claims)}


@router.get("/single")
async def generate_single_claim(seed: Optional[int] = None):
    """
    Generate a single synthetic claim.

    Args:
        seed: Optional random seed

    Returns:
        Single synthetic claim
    """
    return generate_synthetic_claim(seed)


@router.get("/dataset")
async def generate_dataset(
    n_samples: int = 10000,
    seed: int = 42
):
    """
    Generate a training dataset.

    Args:
        n_samples: Number of samples
        seed: Random seed

    Returns:
        Dataset info and sample claims
    """
    return generate_training_dataset(n_samples, seed)


@router.post("/stream/start")
async def start_stream(
    req: Request,
    background_tasks: BackgroundTasks,
    interval_ms: int = 1000
):
    """
    Start streaming synthetic claims.

    Args:
        req: FastAPI request object
        background_tasks: Background task manager
        interval_ms: Interval between claims in milliseconds

    Returns:
        Stream status
    """
    global streaming_active, streaming_task

    if streaming_active:
        return {"status": "already_running"}

    streaming_active = True
    ws_manager = req.app.state.ws_manager

    async def stream_claims():
        global streaming_active

        # Reference stats for drift calculation
        reference_stats = {
            "mean_billed_amount": 500,
            "approval_rate": 0.7
        }

        batch = []
        batch_size = 10

        while streaming_active:
            claim = generate_synthetic_claim()
            batch.append(claim)

            # Send claim event
            await ws_manager.send_claim_event(claim)

            # Calculate and send drift every batch_size claims
            if len(batch) >= batch_size:
                drift = calculate_drift_metrics(batch, reference_stats)
                await ws_manager.send_drift_update(drift)
                batch = []

            await asyncio.sleep(interval_ms / 1000)

    streaming_task = asyncio.create_task(stream_claims())

    return {
        "status": "started",
        "interval_ms": interval_ms,
        "message": "Connect to /ws/claims to receive stream"
    }


@router.post("/stream/stop")
async def stop_stream():
    """
    Stop the claims stream.

    Returns:
        Stream status
    """
    global streaming_active, streaming_task

    streaming_active = False

    if streaming_task:
        streaming_task.cancel()
        streaming_task = None

    return {"status": "stopped"}


@router.get("/stream/status")
async def stream_status():
    """
    Get current stream status.

    Returns:
        Stream status
    """
    return {
        "active": streaming_active,
        "message": "Stream is running" if streaming_active else "Stream is stopped"
    }


@router.get("/drift")
async def calculate_current_drift(n_samples: int = 100, seed: Optional[int] = None):
    """
    Generate a batch and calculate drift metrics.

    Args:
        n_samples: Number of samples
        seed: Optional random seed

    Returns:
        Drift metrics
    """
    batch = generate_claims_batch(n_samples, seed)

    reference_stats = {
        "mean_billed_amount": 500,
        "approval_rate": 0.7
    }

    drift = calculate_drift_metrics(batch, reference_stats)
    return drift


@router.get("/schema")
async def get_schema():
    """
    Get the claims data schema.

    Returns:
        Schema definition
    """
    return {
        "schema": {
            "claim_id": {"type": "string", "description": "Unique claim identifier"},
            "timestamp": {"type": "datetime", "description": "Claim timestamp"},
            "cpt_bucket": {"type": "category", "values": CPT_BUCKETS, "description": "CPT code category"},
            "provider_type": {"type": "category", "values": PROVIDER_TYPES, "description": "Provider type"},
            "billed_amount": {"type": "float", "description": "Amount billed"},
            "allowed_amount": {"type": "float", "description": "Allowed amount"},
            "diagnosis_group": {"type": "category", "values": DIAGNOSIS_GROUPS, "description": "Diagnosis category"},
            "patient_age": {"type": "integer", "description": "Patient age in years"},
            "service_date": {"type": "date", "description": "Date of service"},
            "settlement_outcome": {"type": "integer", "values": [0, 1], "description": "0=Denied, 1=Approved"}
        }
    }
