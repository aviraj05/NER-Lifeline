"""
NER-Lifeline: Spatial Index & Graph Manager
(Demo-Optimized Mock Version for Instant Startup)
"""

import math
from typing import List, Tuple, Dict, Any
from ..core.config import GRAPH_PATH


class SpatialHashIndex:
    """Mock spatial index for the demo."""
    def __init__(self, cell_size: float = 0.01):
        self.cell_size = cell_size

    def insert(self, node_id: str, lat: float, lon: float):
        pass

    def query_nearest(self, lat: float, lon: float, search_radius_deg: float = 0.05) -> str | None:
        return "mock_node_123"


class GraphService:
    """Mock graph manager for instant server startup."""

    def __init__(self):
        self._loaded = False
        self.spatial_index = SpatialHashIndex()

    def load(self, graph_path: str | None = None):
        """Mock load that returns instantly."""
        print("[GraphService] DEMO MODE: Loading lightweight mocked corridors instead of 265MB GraphML...")
        self._loaded = True
        print("[GraphService] Initialization complete in < 1 second.")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def find_nearest_node(self, lat: float, lon: float) -> str | None:
        return "mock_node"

    def create_working_copy(self) -> Any:
        return {}  # Mock graph

    def sever_edges_at(self, G: Any, lat: float, lon: float, radius_km: float = 8.0) -> int:
        return 1

    def get_corridor_segments(self, rainfall_mm: float) -> List[Dict[str, Any]]:
        """Returns mock polylines for the Leaflet map (NH6 and NH27)."""
        # Primary Corridor (NH6 - Guwahati to Silchar via Meghalaya)
        nh6_coords = [
            [26.1445, 91.7362], # Guwahati
            [25.5788, 91.8933], # Shillong
            [25.4530, 92.2030], # Jowai
            [25.1130, 92.3610], # Sonapur
            [25.0180, 92.4150], # Kuliang
            [24.8333, 92.7789], # Silchar
        ]
        
        # Secondary Corridor (NH27 - via Haflong)
        nh27_coords = [
            [26.1445, 91.7362], # Guwahati
            [26.2300, 92.6800], # Nagaon
            [25.7500, 93.0300], # Lumding
            [25.1850, 93.0050], # Haflong
            [24.8333, 92.7789], # Silchar
        ]

        segments = []
        
        # Determine NH6 vulnerability
        nh6_vuln = 30
        nh6_color = "#38bdf8"
        if rainfall_mm > 100:
            nh6_vuln = 85
            nh6_color = "#f43f5e"
        elif rainfall_mm > 30:
            nh6_vuln = 55
            nh6_color = "#f59e0b"

        segments.append({
            "coords": nh6_coords,
            "vulnerability_score": nh6_vuln,
            "color": nh6_color
        })

        segments.append({
            "coords": nh27_coords,
            "vulnerability_score": 20,
            "color": "#38bdf8"
        })

        return segments

graph_service = GraphService()
