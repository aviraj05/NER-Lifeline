"""
NER-Lifeline: Mock Vahan API Endpoint
Simulates fetching vehicle registration data for heavy commercial vehicles.
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class VahanResponse(BaseModel):
    reg_no: str
    vehicle_class: str
    max_weight_tons: float
    width_meters: float
    axles: int
    fuel_type: str

@router.get("/api/vahan/vehicle/{reg_no}", response_model=VahanResponse)
def get_vahan_data(reg_no: str):
    """
    Mock Vahan API to fetch vehicle details by registration number.
    Returns deterministic constraints based on the prefix of the reg number.
    """
    prefix = reg_no.upper().strip()
    
    if prefix.startswith("AS01") or prefix.startswith("NL01") or prefix.startswith("TR01"):
        # Heavy Commercial Vehicle
        return VahanResponse(
            reg_no=reg_no,
            vehicle_class="HCV",
            max_weight_tons=35.0,
            width_meters=2.6,
            axles=6,
            fuel_type="DIESEL"
        )
    elif prefix.startswith("ML05") or prefix.startswith("MZ01"):
        # Medium Commercial Vehicle
        return VahanResponse(
            reg_no=reg_no,
            vehicle_class="MCV",
            max_weight_tons=16.0,
            width_meters=2.3,
            axles=2,
            fuel_type="DIESEL"
        )
    else:
        # Default to Light Commercial Vehicle
        return VahanResponse(
            reg_no=reg_no,
            vehicle_class="LCV",
            max_weight_tons=7.5,
            width_meters=2.0,
            axles=2,
            fuel_type="CNG"
        )
