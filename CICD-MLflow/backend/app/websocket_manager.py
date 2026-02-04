"""
WebSocket connection manager for real-time log streaming.
Handles multiple concurrent connections and message broadcasting.
"""

from fastapi import WebSocket
from typing import Dict, List, Set
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages WebSocket connections for streaming logs and events.

    Supports multiple subscribers per run_id and provides
    methods for broadcasting messages to specific runs or all connections.
    """

    def __init__(self):
        # Map of run_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, run_id: str):
        """
        Accept and register a new WebSocket connection.

        Args:
            websocket: The WebSocket connection to register
            run_id: The run identifier to subscribe to
        """
        await websocket.accept()

        async with self._lock:
            if run_id not in self.active_connections:
                self.active_connections[run_id] = set()
            self.active_connections[run_id].add(websocket)

        logger.info(f"WebSocket connected for run_id: {run_id}")

    def disconnect(self, websocket: WebSocket, run_id: str):
        """
        Remove a WebSocket connection from the registry.

        Args:
            websocket: The WebSocket connection to remove
            run_id: The run identifier to unsubscribe from
        """
        if run_id in self.active_connections:
            self.active_connections[run_id].discard(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]

        logger.info(f"WebSocket disconnected for run_id: {run_id}")

    async def send_log(self, run_id: str, message: str, level: str = "info"):
        """
        Send a log message to all connections subscribed to a run.

        Args:
            run_id: The run identifier
            message: Log message content
            level: Log level (info, warning, error, debug)
        """
        await self.broadcast(run_id, {
            "type": "log",
            "timestamp": datetime.utcnow().isoformat(),
            "level": level,
            "message": message
        })

    async def send_status(self, run_id: str, step_name: str, status: str, **kwargs):
        """
        Send a status update for a pipeline step.

        Args:
            run_id: The run identifier
            step_name: Name of the step
            status: New status value
            **kwargs: Additional data to include
        """
        await self.broadcast(run_id, {
            "type": "status",
            "timestamp": datetime.utcnow().isoformat(),
            "step_name": step_name,
            "status": status,
            **kwargs
        })

    async def send_metrics(self, run_id: str, metrics: dict):
        """
        Send metrics data to all connections subscribed to a run.

        Args:
            run_id: The run identifier
            metrics: Dictionary of metrics to send
        """
        await self.broadcast(run_id, {
            "type": "metrics",
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        })

    async def send_artifact(self, run_id: str, artifact_name: str, artifact_type: str, url: str = None):
        """
        Notify about a new artifact.

        Args:
            run_id: The run identifier
            artifact_name: Name of the artifact
            artifact_type: Type of artifact (plot, model, data)
            url: Optional URL to access the artifact
        """
        await self.broadcast(run_id, {
            "type": "artifact",
            "timestamp": datetime.utcnow().isoformat(),
            "artifact_name": artifact_name,
            "artifact_type": artifact_type,
            "url": url
        })

    async def send_claim_event(self, claim_data: dict):
        """
        Send a synthetic claim event to the claims stream.

        Args:
            claim_data: Dictionary containing claim data
        """
        await self.broadcast("claims_stream", {
            "type": "claim",
            "timestamp": datetime.utcnow().isoformat(),
            "data": claim_data
        })

    async def send_drift_update(self, drift_data: dict):
        """
        Send drift monitoring data to the claims stream.

        Args:
            drift_data: Dictionary containing drift metrics
        """
        await self.broadcast("claims_stream", {
            "type": "drift",
            "timestamp": datetime.utcnow().isoformat(),
            "data": drift_data
        })

    async def broadcast(self, run_id: str, message: dict):
        """
        Broadcast a message to all connections subscribed to a run.

        Args:
            run_id: The run identifier
            message: Message dictionary to send
        """
        if run_id not in self.active_connections:
            return

        # Get copy of connections to avoid modification during iteration
        connections = list(self.active_connections.get(run_id, set()))

        for websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send message to WebSocket: {e}")
                # Remove failed connection
                self.disconnect(websocket, run_id)

    async def broadcast_all(self, message: dict):
        """
        Broadcast a message to all active connections.

        Args:
            message: Message dictionary to send
        """
        for run_id in list(self.active_connections.keys()):
            await self.broadcast(run_id, message)

    def get_connection_count(self, run_id: str = None) -> int:
        """
        Get the number of active connections.

        Args:
            run_id: Optional run_id to get count for specific run

        Returns:
            Number of active connections
        """
        if run_id:
            return len(self.active_connections.get(run_id, set()))
        return sum(len(conns) for conns in self.active_connections.values())
