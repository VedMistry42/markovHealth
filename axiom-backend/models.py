"""
models.py — Request/Response schemas for the markovHealth RL routing engine.

The key addition over a standard routing API is:
  - fragility_index on PatientRequest: derived from ECOG status, drives the
    Empathy Penalty term β·d·F in the reward function.
  - EmpathyMetrics + LogisticsPlan on RouteResponse: gives the frontend enough
    data to render the "Saved patient X miles of travel" toast.
"""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Location(BaseModel):
    lat: float = Field(..., description="Latitude in decimal degrees (WGS-84)")
    lng: float = Field(..., description="Longitude in decimal degrees (WGS-84)")
    name: Optional[str] = Field(None, description="Optional place name")


class ActionEnum(str, Enum):
    HUB_FLIGHT   = "HUB_FLIGHT"
    LOCAL_CLINIC = "LOCAL_CLINIC"
    MOBILE_UNIT  = "MOBILE_UNIT"


class MatchData(BaseModel):
    condition: str = Field(..., description="Primary diagnosis")
    urgency: str   = Field(..., description="Triage urgency: high | medium | low")
    # ECOG 0-4 → fragility 0.0-1.0 (computed by caller or set explicit)
    ecog_status: Optional[int] = Field(None, ge=0, le=4,
        description="ECOG performance status 0-4. Used to compute fragility if fragility_index is not set.")


class PatientRequest(BaseModel):
    patient_id:      str      = Field(..., description="Unique patient identifier")
    patient_coords:  Location = Field(..., description="Current GPS position")
    is_match:        bool     = Field(..., description="True if matched to trial")
    match_score:     float    = Field(default=85.0, ge=0, le=100,
        description="Confidence score from the AI matcher (0-100). Used as α·M in reward.")
    fragility_index: float    = Field(default=0.3, ge=0.0, le=1.0,
        description="Patient fragility 0.0 (fit) to 1.0 (highly fragile). "
                    "Derived from ECOG: ECOG/4. High fragility penalises travel-heavy actions.")
    match_data: Optional[MatchData] = Field(None)


class CostAnalysis(BaseModel):
    friction_score:      float = Field(..., ge=0, le=100)
    cost_usd:            float = Field(..., ge=0)
    empathy_penalty:     float = Field(default=0.0,
        description="β·d·F — the fragility-weighted distance penalty from the reward function.")
    friction_rationale:  str   = Field(...)
    cost_rationale:      str   = Field(...)


class Geometry(BaseModel):
    type:        str             = Field("LineString")
    coordinates: List[List[float]] = Field(...)


class EmpathyMetrics(BaseModel):
    """Human-readable summary of the patient-protection decision."""
    patient_travel_saved_miles: float = Field(default=0.0,
        description="Miles of travel the patient is saved vs. the worst-case action.")
    fragility_accommodated: bool = Field(default=False,
        description="True when fragility was high enough to override a cheaper action.")
    empathy_penalty_applied: float = Field(default=0.0,
        description="The β·d·F penalty that drove the engine's decision.")
    best_vs_worst_reward_delta: float = Field(default=0.0,
        description="Reward gap between the chosen action and the lowest-scoring alternative.")


class LogisticsPlan(BaseModel):
    decision:       str            = Field(...)
    route:          dict           = Field(..., description="GeoJSON Feature with LineString geometry")
    estimated_time: str            = Field(...)
    empathy_metrics: EmpathyMetrics = Field(...)


class RouteResponse(BaseModel):
    selected_action: ActionEnum     = Field(...)
    rationale:       str            = Field(...)
    cost_analysis:   CostAnalysis   = Field(...)
    geometry:        Geometry       = Field(...)
    logistics_plan:  LogisticsPlan  = Field(...)
