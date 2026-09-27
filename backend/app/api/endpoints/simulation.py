"""
NER-Lifeline: Simulation Endpoints (The "Disaster Injector")

Provides preset-driven disaster simulation for demo and training:
  - Normal Baseline: Clear all incidents, reset to green
  - Monsoon Heavy Rain Warning: Inject 140mm/hr, CAUTION state
  - NH6 Sonapur Tunnel Collapse: Sever corridor, CRITICAL state
"""

import time
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...core.config import SIMULATION_PRESETS
from ...services.weather import weather_service
from .incidents import active_incidents

router = APIRouter()

# Track current simulation state
current_simulation = {"preset": "normal_baseline", "activated_at": None}


class SimulationRequest(BaseModel):
    preset: str  # "normal_baseline", "monsoon_heavy", "nh6_collapse"


@router.post("/api/simulation/activate")
def activate_simulation(req: SimulationRequest):
    """
    Activate a disaster simulation preset.
    Clears existing incidents and injects preset-defined conditions.
    """
    preset = SIMULATION_PRESETS.get(req.preset)
    if not preset:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown preset: {req.preset}. Available: {list(SIMULATION_PRESETS.keys())}",
        )

    # Clear existing state
    active_incidents.clear()

    # Apply rainfall override
    weather_service.set_rainfall_override(preset["rainfall_override"])

    # Inject preset incidents
    for inc_data in preset["incidents"]:
        incident = {
            **inc_data,
            "timestamp": time.time(),
            "synced": True,
            "id": f"sim_{req.preset}_{int(time.time() * 1000)}",
            "image_base64": None,
        }
        active_incidents.append(incident)

    # Update state tracker
    current_simulation["preset"] = req.preset
    current_simulation["activated_at"] = time.time()

    return {
        "status": "success",
        "preset": req.preset,
        "label": preset["label"],
        "description": preset["description"],
        "incidents_injected": len(preset["incidents"]),
        "rainfall_override": preset["rainfall_override"],
    }


@router.get("/api/simulation/status")
def get_simulation_status():
    """Return the current simulation state."""
    preset_key = current_simulation["preset"]
    preset = SIMULATION_PRESETS.get(preset_key, SIMULATION_PRESETS["normal_baseline"])

    return {
        "status": "success",
        "current_preset": preset_key,
        "label": preset["label"],
        "description": preset["description"],
        "activated_at": current_simulation["activated_at"],
        "active_incidents": len(active_incidents),
    }
