"""
NER-Lifeline: Centralized Configuration
Choke points, cargo coefficients, district baselines, and API settings.
"""

import os

# ---------------------------------------------------------------------------
# Graph data path – look next to the backend folder first, then fall back
# ---------------------------------------------------------------------------
GRAPH_PATH = os.environ.get(
    "GRAPH_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "ner_corridor_graph.graphml"),
)

# ---------------------------------------------------------------------------
# Critical geographic choke points in the NER corridor
# ---------------------------------------------------------------------------
CHOKE_POINTS = [
    {
        "id": "cp_sonapur",
        "name": "Sonapur Tunnel (NH6)",
        "lat": 25.1130,
        "lon": 92.3610,
        "radius_deg": 0.22,
        "elevation_m": 720.0,
        "highway": "NH6",
    },
    {
        "id": "cp_kuliang",
        "name": "Kuliang-Ratacherra Stretch",
        "lat": 25.0180,
        "lon": 92.4150,
        "radius_deg": 0.18,
        "elevation_m": 640.0,
        "highway": "NH6",
    },
    {
        "id": "cp_jatinga",
        "name": "Jatinga-Haflong (NH27 / Dima Hasao)",
        "lat": 25.1850,
        "lon": 93.0050,
        "radius_deg": 0.15,
        "elevation_m": 680.0,
        "highway": "NH27",
    },
]

# ---------------------------------------------------------------------------
# Well-known corridor endpoints
# ---------------------------------------------------------------------------
GUWAHATI = {"name": "Guwahati Supply Hub", "lat": 26.1445, "lon": 91.7362}
SILCHAR = {"name": "Silchar Civil Hospital", "lat": 24.8333, "lon": 92.7789}
SHILLONG = {"name": "Shillong Transit", "lat": 25.5788, "lon": 91.8933}
JOWAI = {"name": "Jowai Junction", "lat": 25.4530, "lon": 92.2030}

# ---------------------------------------------------------------------------
# Cargo type friction coefficients  (ω_cargo multiplier)
# Higher ω means more risk-averse – the route avoids hazard zones harder.
# ---------------------------------------------------------------------------
CARGO_PROFILES = {
    "critical_medical": {
        "label": "Critical Medical (Oxygen / Vaccines)",
        "omega": 3.5,
        "icon": "💉",
        "color": "#ef4444",
    },
    "perishable_food": {
        "label": "Perishable Food & Produce",
        "omega": 2.0,
        "icon": "🥬",
        "color": "#f59e0b",
    },
    "petroleum": {
        "label": "Petroleum & Fuel Tankers",
        "omega": 1.5,
        "icon": "⛽",
        "color": "#8b5cf6",
    },
    "general_freight": {
        "label": "General Freight",
        "omega": 0.3,
        "icon": "📦",
        "color": "#6b7280",
    },
}

# ---------------------------------------------------------------------------
# Hazard model coefficients  (α, β, γ, δ in the friction formula)
# C(e) = Length × (1 + ω_cargo × [α·Rainfall + β·Slope + γ·SoilSat] + δ·IncidentPenalty)
# ---------------------------------------------------------------------------
ALPHA_RAINFALL = 0.008       # per mm/hr – scales rainfall impact
BETA_SLOPE = 0.12            # per degree of slope gradient
GAMMA_SOIL_SAT = 0.015       # per % soil saturation
DELTA_INCIDENT = 5.0         # flat penalty multiplier for incident proximity

# ---------------------------------------------------------------------------
# District supply baselines (Cachar / Barak Valley)
# These represent estimated current stock levels under normal corridor flow.
# ---------------------------------------------------------------------------
DISTRICT_BASELINES = {
    "Cachar & Barak Valley": {
        "medical_oxygen": {"normal_days": 6.8, "isolated_days": 2.4, "unit": "Days"},
        "petroleum": {"normal_days": 8.5, "isolated_days": 3.1, "unit": "Days"},
        "essential_grains": {"normal_days": 14.0, "isolated_days": 5.0, "unit": "Days"},
    }
}

# ---------------------------------------------------------------------------
# Simulation presets
# ---------------------------------------------------------------------------
SIMULATION_PRESETS = {
    "normal_baseline": {
        "label": "Normal Baseline",
        "description": "All corridors operational. Clear weather.",
        "rainfall_override": None,
        "incidents": [],
    },
    "monsoon_heavy": {
        "label": "Monsoon Heavy Rain Warning",
        "description": "140 mm/hr rainfall at Sonapur Tunnel. Roads degraded to CAUTION.",
        "rainfall_override": 140.0,
        "incidents": [
            {
                "incident_type": "heavy_rainfall",
                "latitude": 25.1130,
                "longitude": 92.3610,
                "severity": "CAUTION",
                "description": "Extreme precipitation at Sonapur. Soil saturation critical. Single-lane restriction.",
                "reporter_name": "Weather Automated Alert",
            }
        ],
    },
    "nh6_collapse": {
        "label": "NH6 Sonapur Tunnel Collapse",
        "description": "Catastrophic landslide at Kuliang. NH6 completely severed. Barak Valley isolated.",
        "rainfall_override": 160.0,
        "incidents": [
            {
                "incident_type": "landslide",
                "latitude": 25.1130,
                "longitude": 92.3610,
                "severity": "BLOCK",
                "description": "Massive debris flow at Sonapur Tunnel. NH6 completely cut off. No vehicular transit possible.",
                "reporter_name": "BRO Emergency Dispatch",
            },
            {
                "incident_type": "landslide",
                "latitude": 25.0180,
                "longitude": 92.4150,
                "severity": "BLOCK",
                "description": "Secondary slope failure at Kuliang-Ratacherra. Corridor severed at two points.",
                "reporter_name": "PWD Structural Unit",
            },
        ],
    },
}

# ---------------------------------------------------------------------------
# Open-Meteo API
# ---------------------------------------------------------------------------
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation"
WEATHER_CACHE_TTL_SECONDS = 300  # 5 minutes

# ---------------------------------------------------------------------------
# Multilingual alert templates
# ---------------------------------------------------------------------------
MULTILINGUAL_ALERTS = {
    "corridor_clear": {
        "en": "All NER corridors operational. Supply flow normal.",
        "hi": "सभी NER गलियारे सक्रिय हैं। आपूर्ति प्रवाह सामान्य।",
        "as": "সকলো NER কৰিড'ৰ সক্ৰিয়। যোগান প্ৰবাহ স্বাভাৱিক।",
        "bn": "সমস্ত NER করিডোর সক্রিয়। সরবরাহ প্রবাহ স্বাভাবিক।",
        "kh": "Ka jingialang NER baroh ki long kam. Ka jingpynkynmaw ka long normal.",
    },
    "monsoon_warning": {
        "en": "⚠️ Heavy monsoon rainfall detected at Sonapur. Road conditions degrading.",
        "hi": "⚠️ सोनापुर में भारी मानसून वर्षा। सड़क की स्थिति बिगड़ रही है।",
        "as": "⚠️ সোনাপুৰত প্ৰচণ্ড মৌচুমী বৰষুণ। পথৰ অৱস্থা বেয়া হৈছে।",
        "bn": "⚠️ সোনাপুরে প্রবল বর্ষণ শনাক্ত। রাস্তার অবস্থা খারাপ হচ্ছে।",
        "kh": "⚠️ Slap bun ba Sonapur. Ka jaka lynti ka long jingiapher.",
    },
    "nh6_severed": {
        "en": "🚨 CRITICAL: NH6 corridor severed. Barak Valley isolated. Emergency rerouting via NH27.",
        "hi": "🚨 गंभीर: NH6 गलियारा कटा। बराक घाटी अलग-थलग। NH27 से आपातकालीन मार्ग।",
        "as": "🚨 সংকটজনক: NH6 কৰিড'ৰ বিচ্ছিন্ন। বৰাক উপত্যকা বিচ্ছিন্ন। NH27 ৰে জৰুৰীকালীন পথ।",
        "bn": "🚨 সংকটজনক: NH6 করিডোর বিচ্ছিন্ন। বরাক উপত্যকা বিচ্ছিন্ন। NH27 দিয়ে জরুরি রুট।",
        "kh": "🚨 JINGIASNOH: NH6 ka long kut. Barak Valley ka long jingiapher. NH27 ka long lynti jingpynkynmaw.",
    },
}

# ---------------------------------------------------------------------------
# Server settings
# ---------------------------------------------------------------------------
SERVER_HOST = os.environ.get("HOST", "0.0.0.0")
SERVER_PORT = int(os.environ.get("PORT", "8000"))
