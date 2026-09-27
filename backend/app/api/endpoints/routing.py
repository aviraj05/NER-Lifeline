"""
NER-Lifeline: Routing Endpoints (Demo-Optimized)

Returns predefined optimized routes based on current simulation state
and hazard blockage.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ...services.graph_service import graph_service
from ...services.weather import weather_service
from ...core.config import CHOKE_POINTS, CARGO_PROFILES
from .incidents import active_incidents

router = APIRouter()


class RouteRequest(BaseModel):
    start_lat: float
    start_lon: float
    dest_lat: float
    dest_lon: float
    cargo_type: str = "critical_medical"
    vehicle_class: str = "LCV"


@router.post("/api/route")
def compute_route(req: RouteRequest):
    """
    Returns the optimal route. For the demo, this uses predefined coordinates 
    for NH6 (Primary) and NH27 (Secondary) based on the incident state.
    """
    if not graph_service.is_loaded:
        raise HTTPException(status_code=503, detail="Graph not loaded yet.")

    # Check if NH6 is blocked
    nh6_blocked = any(
        inc["severity"] == "BLOCK"
        and 24.9 < inc["latitude"] < 25.3
        and 92.2 < inc["longitude"] < 92.6
        for inc in active_incidents
    )

    has_caution = any(
        inc["severity"] == "CAUTION"
        and 24.9 < inc["latitude"] < 25.3
        for inc in active_incidents
    )

    # Prune routes for HCV (Heavy Commercial Vehicle)
    hcv_restricted = req.vehicle_class == "HCV" and has_caution

    if nh6_blocked or hcv_restricted:
        # NH27 Secondary Route
        path = [
            [26.1445, 91.7362], [26.1600, 92.0000], [26.2300, 92.6800], 
            [26.0000, 92.9000], [25.7500, 93.0300], [25.5000, 93.1000],
            [25.1850, 93.0050], [24.9500, 92.9000], [24.8333, 92.7789]
        ]
        total_dist_km = 340.5
    else:
        # NH6 Primary Route — strictly within Indian territory
        # Follows the actual road: Guwahati → Shillong → Jowai → East Jaintia Hills
        # then descends into the Barak Valley via Jiribam road (Cachar, Assam),
        # hugging north of the India–Bangladesh border the entire way.
        path = [
            [26.1445, 91.7362],  # Guwahati Supply Hub
            [25.9000, 91.8000],  # Jorabat / Meghalaya entry
            [25.5788, 91.8933],  # Shillong
            [25.4530, 92.2030],  # Jowai (East Jaintia Hills)
            [25.3500, 92.2800],  # Muktapur / Sutnga stretch
            [25.2700, 92.3200],  # Nongtalang area
            [25.2000, 92.3800],  # Kuliang (Meghalaya/Assam border ridge)
            [25.1800, 92.4500],  # Ratacherra top — stays on ridge, strictly in India
            [25.1600, 92.5200],  # Laitkroh / descent toward Cachar
            [25.1400, 92.5900],  # Narpuh WLS eastern boundary (Assam side)
            [25.1200, 92.6400],  # Jiribam approach (Assam)
            [25.0500, 92.6900],  # Lakhipur, Cachar District, Assam
            [24.9800, 92.7200],  # Sonai, Cachar District, Assam
            [24.9200, 92.7500],  # Udharbond area
            [24.8700, 92.7650],  # Silchar approaches
            [24.8333, 92.7789],  # Silchar Civil Hospital
        ]
        total_dist_km = 215.3

    rain_val = weather_service.fetch_rainfall(CHOKE_POINTS[0]["lat"], CHOKE_POINTS[0]["lon"])

    # Estimate travel time
    avg_speed = 35.0 if req.cargo_type == "critical_medical" else 40.0
    if req.vehicle_class == "HCV":
        avg_speed *= 0.75  # HCVs move slower
    
    eta_hours = total_dist_km / avg_speed

    cargo_profile = CARGO_PROFILES.get(req.cargo_type, CARGO_PROFILES["general_freight"])

    return {
        "status": "success",
        "cargo_type": req.cargo_type,
        "cargo_label": cargo_profile["label"],
        "total_distance_km": round(total_dist_km, 2),
        "estimated_time_hours": round(eta_hours, 1),
        "path": path,
        "path_nodes": len(path),
        "risk_level": "HIGH" if rain_val > 80 else "MODERATE" if rain_val > 30 else "LOW",
    }


@router.get("/api/corridor-segments")
def get_corridor_segments():
    """Returns segments with vulnerability scores for edge-level heatmaps."""
    rain_val = weather_service.fetch_rainfall(CHOKE_POINTS[0]["lat"], CHOKE_POINTS[0]["lon"])
    segments = graph_service.get_corridor_segments(rainfall_mm=rain_val)
    return {"segments": segments}
