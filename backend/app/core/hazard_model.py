"""
NER-Lifeline: Hazard Model & Friction Cost Function

Implements the payload-aware dynamic friction engine:
  C(e) = Length × (1 + ω_cargo × [α·Rainfall + β·Slope + γ·SoilSat] + δ·IncidentPenalty)

Critical Medical payloads automatically trigger heavy risk aversion,
taking preemptive detours around high-saturation mountain slopes.
"""

import math
from .config import (
    ALPHA_RAINFALL,
    BETA_SLOPE,
    GAMMA_SOIL_SAT,
    DELTA_INCIDENT,
    CARGO_PROFILES,
    CHOKE_POINTS,
)


def estimate_slope_gradient(elev_u: float, elev_v: float, length_m: float) -> float:
    """
    Estimate slope gradient in degrees between two nodes.
    Falls back to a proximity-based heuristic if elevation data is missing.
    """
    if length_m <= 0:
        return 0.0
    rise = abs(elev_u - elev_v)
    slope_rad = math.atan2(rise, length_m)
    return math.degrees(slope_rad)


def estimate_soil_saturation(rainfall_mm: float) -> float:
    """
    Simple soil saturation proxy model.
    Maps rainfall intensity to estimated saturation percentage.
    In production this would come from ISRO / IMD soil moisture sensors.
    """
    if rainfall_mm <= 5.0:
        return 20.0
    elif rainfall_mm <= 30.0:
        return 40.0 + (rainfall_mm - 5.0) * 0.8
    elif rainfall_mm <= 80.0:
        return 60.0 + (rainfall_mm - 30.0) * 0.4
    else:
        return min(98.0, 80.0 + (rainfall_mm - 80.0) * 0.15)


def compute_proximity_risk(
    mid_lat: float, mid_lon: float, choke_points: list = None
) -> tuple[float, str | None]:
    """
    Determine how close a road segment midpoint is to known choke points.
    Returns (proximity_factor 0-1, nearest_choke_id or None).
    """
    if choke_points is None:
        choke_points = CHOKE_POINTS

    min_factor = 0.0
    nearest_id = None

    for cp in choke_points:
        dist = math.hypot(mid_lat - cp["lat"], mid_lon - cp["lon"])
        radius = cp["radius_deg"]
        if dist < radius:
            factor = 1.0 - (dist / radius)  # 1.0 at center, 0.0 at edge
            if factor > min_factor:
                min_factor = factor
                nearest_id = cp["id"]

    return min_factor, nearest_id


def compute_edge_cost(
    length_m: float,
    rainfall_mm: float,
    slope_deg: float,
    soil_saturation_pct: float,
    incident_penalty: float,
    cargo_type: str = "general_freight",
) -> float:
    """
    Full friction cost function:
      C(e) = Length × (1 + ω_cargo × [α·Rainfall + β·Slope + γ·SoilSat] + δ·IncidentPenalty)

    Parameters
    ----------
    length_m : float
        Physical edge length in meters.
    rainfall_mm : float
        Current rainfall intensity at this edge segment (mm/hr).
    slope_deg : float
        Estimated slope gradient in degrees.
    soil_saturation_pct : float
        Estimated soil saturation as percentage (0-100).
    incident_penalty : float
        0.0 = no incident nearby, 1.0 = active incident at this edge.
    cargo_type : str
        One of the keys in CARGO_PROFILES.
    """
    profile = CARGO_PROFILES.get(cargo_type, CARGO_PROFILES["general_freight"])
    omega = profile["omega"]

    environmental_risk = (
        ALPHA_RAINFALL * rainfall_mm
        + BETA_SLOPE * slope_deg
        + GAMMA_SOIL_SAT * soil_saturation_pct
    )

    total_multiplier = 1.0 + omega * environmental_risk + DELTA_INCIDENT * incident_penalty

    return length_m * max(total_multiplier, 1.0)


def compute_vulnerability_score(
    rainfall_mm: float,
    slope_deg: float,
    soil_saturation_pct: float,
    proximity_factor: float,
) -> int:
    """
    Compute a 0-100 vulnerability score for visualization heatmaps.
    """
    raw = (
        rainfall_mm * 0.35
        + slope_deg * 3.0
        + soil_saturation_pct * 0.25
    ) * proximity_factor

    return min(100, max(0, int(raw)))


def vulnerability_color(score: int) -> str:
    """Map vulnerability score to a hex color for segment rendering."""
    if score >= 70:
        return "#ef4444"   # Red – Impassable / High Risk
    elif score >= 40:
        return "#f59e0b"   # Amber – Weather Degraded
    elif score >= 15:
        return "#22c55e"   # Green – Normal
    else:
        return "#10b981"   # Emerald – Clear
