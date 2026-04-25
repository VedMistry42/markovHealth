"""
models.py — markovHealth RL routing schemas.

Key additions over a standard routing API:
  fragility_index: drives β·d·F empathy penalty in reward function.
  EmpathyMetrics:  tells the frontend "Saved patient X miles of travel."
  LogisticsPlan:   complete frontend-ready payload with GeoJSON route.
"""
from enum import Enum
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


class Location(BaseModel):
    lat: float = Field(..., description="Latitude (WGS-84)")
    lng: float = Field(..., description="Longitude (WGS-84)")
    name: Optional[str] = None


class ActionEnum(str, Enum):
    HUB_FLIGHT   = "HUB_FLIGHT"
    LOCAL_CLINIC = "LOCAL_CLINIC"
    MOBILE_UNIT  = "MOBILE_UNIT"


class MatchData(BaseModel):
    condition:    str           = Field(..., description="Primary diagnosis")
    urgency:      str           = Field(..., description="high | medium | low")
    ecog_status:  Optional[int] = Field(None, ge=0, le=4,
        description="ECOG 0-4. Used to derive fragility_index if not set explicitly.")


class PatientRequest(BaseModel):
    patient_id:      str            = Field(...)
    patient_coords:  Location       = Field(...)
    is_match:        bool           = Field(...)
    match_score:     float          = Field(default=85.0, ge=0, le=100,
        description="α·M input: AI confidence score 0-100.")
    fragility_index: float          = Field(default=0.25, ge=0.0, le=1.0,
        description="F_i ∈ [0,1]. 0=fit, 1=fully fragile. Drives β·d·F penalty.")
    match_data:      Optional[MatchData] = None


class CostAnalysis(BaseModel):
    friction_score:     float = Field(..., ge=0, le=100)
    cost_usd:           float = Field(..., ge=0)
    empathy_penalty:    float = Field(default=0.0,
        description="β·d·F — the fragility-weighted distance penalty.")
    friction_rationale: str   = Field(...)
    cost_rationale:     str   = Field(...)


class Geometry(BaseModel):
    type:        str                  = Field("LineString")
    coordinates: List[List[float]]   = Field(...)


class EmpathyMetrics(BaseModel):
    patient_travel_saved_miles:  float = Field(default=0.0)
    fragility_accommodated:      bool  = Field(default=False)
    empathy_penalty_applied:     float = Field(default=0.0)
    best_vs_worst_reward_delta:  float = Field(default=0.0)


class LogisticsPlan(BaseModel):
    decision:        str                   = Field(...)
    route:           Dict[str, Any]        = Field(..., description="GeoJSON Feature")
    estimated_time:  str                   = Field(...)
    empathy_metrics: EmpathyMetrics        = Field(...)


class RouteResponse(BaseModel):
    selected_action:  ActionEnum     = Field(...)
    rationale:        str            = Field(...)
    cost_analysis:    CostAnalysis   = Field(...)
    geometry:         Geometry       = Field(...)
    logistics_plan:   LogisticsPlan  = Field(...)
