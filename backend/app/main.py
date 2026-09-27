"""
NER-Lifeline: FastAPI Application Bootstrap

Central application factory with:
  - CORS middleware for cross-origin frontend requests
  - Lifespan events for graph loading on startup
  - Static file serving for dashboard and field PWA
  - Router registration for all API endpoints
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .services.graph_service import graph_service
from .api.endpoints import routing, incidents, telemetry, simulation, vahan


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the graph on startup, cleanup on shutdown."""
    graph_service.load()
    yield
    print("[NER-Lifeline] Shutting down.")


app = FastAPI(
    title="NER-Lifeline: Spatial Logistics & Emergency Supply Resilience Platform",
    description="Hazard-aware spatial decision support for the North Eastern Region of India",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS – allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(routing.router)
app.include_router(incidents.router)
app.include_router(telemetry.router)
app.include_router(simulation.router)
app.include_router(vahan.router)

# ---------------------------------------------------------------------------
# Static file serving for frontends
# ---------------------------------------------------------------------------
_base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_dashboard_dir = os.path.join(_base_dir, "frontend-dashboard")
_field_dir = os.path.join(_base_dir, "field-pwa")


# Dashboard routes
@app.get("/dashboard")
@app.get("/dashboard/")
async def serve_dashboard():
    return FileResponse(os.path.join(_dashboard_dir, "index.html"))


@app.get("/field")
@app.get("/field/")
async def serve_field_pwa():
    return FileResponse(os.path.join(_field_dir, "index.html"))


# Mount static directories (CSS, JS, manifest, sw.js)
if os.path.isdir(_dashboard_dir):
    app.mount("/dashboard-static", StaticFiles(directory=_dashboard_dir), name="dashboard-static")

if os.path.isdir(_field_dir):
    app.mount("/field-static", StaticFiles(directory=_field_dir), name="field-static")


# Root redirect
@app.get("/")
async def root():
    return {
        "platform": "NER-Lifeline",
        "version": "2.0.0",
        "endpoints": {
            "dashboard": "/dashboard/",
            "field_pwa": "/field/",
            "api_route": "/api/route",
            "api_telemetry": "/api/corridor-telemetry",
            "api_incidents": "/api/incidents",
            "api_simulation": "/api/simulation/activate",
            "api_docs": "/docs",
        },
    }
