"""
NER-Lifeline: Incident Reporting Endpoints

Handles field incident reports, batch sync from offline queues,
and graph state modification for disaster simulation.
"""

import time
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter()

# Shared in-memory incident store
active_incidents: list[dict] = []


class IncidentReport(BaseModel):
    incident_type: str          # "landslide", "flash_flood", "bridge_damage", "heavy_rainfall"
    latitude: float
    longitude: float
    severity: str               # "BLOCK" or "CAUTION"
    description: Optional[str] = ""
    reporter_name: Optional[str] = "Field Patrol Unit"
    image_base64: Optional[str] = None
    timestamp: Optional[float] = None
    sos_requested: Optional[bool] = False


class BatchSyncRequest(BaseModel):
    incidents: List[IncidentReport]


@router.post("/api/report-incident")
def report_incident(incident: IncidentReport):
    """Log a single incident report from field or simulation."""
    data = incident.dict()
    if not data.get("timestamp"):
        data["timestamp"] = time.time()
    data["synced"] = True
    data["id"] = f"inc_{int(data['timestamp'] * 1000)}"
    active_incidents.append(data)

    return {
        "status": "success",
        "message": "Incident logged to command dispatch.",
        "incident": data,
        "active_count": len(active_incidents),
    }


@router.post("/api/incidents/batch-sync")
def batch_sync(request: BatchSyncRequest):
    """
    Batch upload endpoint for offline queue flush.
    Receives multiple incidents from the field PWA's IndexedDB queue.
    """
    synced_count = 0
    for incident in request.incidents:
        data = incident.dict()
        if not data.get("timestamp"):
            data["timestamp"] = time.time()
        data["synced"] = True
        data["id"] = f"inc_{int(data['timestamp'] * 1000)}_{synced_count}"
        active_incidents.append(data)
        synced_count += 1

    return {
        "status": "success",
        "message": f"Batch synced {synced_count} incident(s) to command dispatch.",
        "synced_count": synced_count,
        "active_count": len(active_incidents),
    }


@router.get("/api/incidents")
def list_incidents():
    """List all active incidents with metadata."""
    return {
        "status": "success",
        "incidents": active_incidents,
        "count": len(active_incidents),
    }


@router.post("/api/reset")
def reset_incidents():
    """Clear all incidents and reset corridor state."""
    active_incidents.clear()
    return {
        "status": "success",
        "message": "All incident triggers cleared. Corridors restored to baseline.",
    }
