"""
Main FastAPI application for the Claim ML CI/CD Lab.
Provides REST endpoints and WebSocket connections for pipeline management.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime

from app.config import settings
from app.database import engine, create_tables
from app.models import PipelineRun, StepStatus
from app.pipeline import PipelineEngine
from app.mlflow_client import MLflowClient
from app.websocket_manager import WebSocketManager
from app.routers import pipeline, steps, mlflow_api, claims, failures

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# WebSocket connection manager
ws_manager = WebSocketManager()

# Pipeline engine instance
pipeline_engine: Optional[PipelineEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown events."""
    global pipeline_engine

    # Startup
    logger.info("Starting Claim ML CI/CD Lab Backend...")

    # Create database tables
    create_tables()
    logger.info("Database tables created/verified")

    # Initialize pipeline engine
    pipeline_engine = PipelineEngine(ws_manager)
    app.state.pipeline_engine = pipeline_engine
    app.state.ws_manager = ws_manager

    # Initialize MLflow client
    mlflow_client = MLflowClient()
    app.state.mlflow_client = mlflow_client

    logger.info(f"MLflow tracking URI: {settings.mlflow_tracking_uri}")
    logger.info("Backend startup complete")

    yield

    # Shutdown
    logger.info("Shutting down Claim ML CI/CD Lab Backend...")


# Create FastAPI app
app = FastAPI(
    title="Claim ML CI/CD Lab",
    description="Enterprise CI/CD simulation for medical claim ML pipelines",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
app.include_router(steps.router, prefix="/steps", tags=["Steps"])
app.include_router(mlflow_api.router, prefix="/mlflow", tags=["MLflow"])
app.include_router(claims.router, prefix="/claims", tags=["Claims"])
app.include_router(failures.router, prefix="/failures", tags=["Failure Modes"])


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Claim ML CI/CD Lab API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "mlflow_ui": settings.mlflow_tracking_uri
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "mlflow_connected": True  # Could add actual connectivity check
    }


@app.websocket("/ws/logs/{run_id}")
async def websocket_logs(websocket: WebSocket, run_id: str):
    """
    WebSocket endpoint for streaming pipeline logs in real-time.

    Args:
        websocket: WebSocket connection
        run_id: Pipeline run identifier
    """
    await ws_manager.connect(websocket, run_id)
    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "connected",
            "run_id": run_id,
            "message": f"Connected to log stream for run {run_id}"
        })

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages (ping/pong or commands)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )

                # Handle ping
                if data == "ping":
                    await websocket.send_text("pong")

            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, run_id)
        logger.info(f"WebSocket disconnected for run {run_id}")
    except Exception as e:
        logger.error(f"WebSocket error for run {run_id}: {e}")
        ws_manager.disconnect(websocket, run_id)


@app.websocket("/ws/claims")
async def websocket_claims(websocket: WebSocket):
    """
    WebSocket endpoint for streaming synthetic claims data.
    """
    await ws_manager.connect(websocket, "claims_stream")
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to claims stream"
        })

        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, "claims_stream")
    except Exception as e:
        logger.error(f"Claims WebSocket error: {e}")
        ws_manager.disconnect(websocket, "claims_stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
