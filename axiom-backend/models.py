from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Location(BaseModel):
    """Geographic coordinate pair with an optional human-readable label.

    Used to represent any point of interest — a patient's current position,
    a clinic, a mobile unit staging area, or a hub airport.
    """

    lat: float = Field(..., description="Latitude in decimal degrees (WGS-84)")
    lng: float = Field(..., description="Longitude in decimal degrees (WGS-84)")
    name: Optional[str] = Field(None, description="Optional place name or identifier")


class ActionEnum(str, Enum):
    """The three care-delivery actions Axiom can recommend.

    HUB_FLIGHT   — Transport the patient by air to a major hub hospital.
    LOCAL_CLINIC  — Direct the patient to the nearest brick-and-mortar clinic.
    MOBILE_UNIT  — Dispatch a mobile health unit to the patient's location.
    """

    HUB_FLIGHT = "HUB_FLIGHT"
    LOCAL_CLINIC = "LOCAL_CLINIC"
    MOBILE_UNIT = "MOBILE_UNIT"


class MatchData(BaseModel):
    """Clinical context attached to a patient who has been flagged as a match.

    Downstream routing logic uses these fields to weigh urgency against the
    friction cost of each ActionEnum option.
    """

    condition: str = Field(
        ...,
        description="Primary diagnosis or chief complaint (e.g. 'chest pain', 'laceration')",
    )
    urgency: str = Field(
        ...,
        description="Triage urgency tier (e.g. 'critical', 'urgent', 'non-urgent')",
    )


class PatientRequest(BaseModel):
    """Inbound payload describing a patient seeking care routing.

    An AI routing agent should inspect `is_match` first; if False, `match_data`
    may be None and the system should return a default low-friction action.
    """

    patient_id: str = Field(..., description="Unique identifier for the patient record")
    patient_coords: Location = Field(
        ..., description="Current GPS position of the patient"
    )
    is_match: bool = Field(
        ...,
        description="True if the patient matches criteria requiring active routing intervention",
    )
    match_data: Optional[MatchData] = Field(
        None,
        description="Clinical details; present only when is_match is True",
    )


class CostAnalysis(BaseModel):
    """Trade-off breakdown between access friction and financial cost.

    Friction captures non-monetary barriers (travel time, remoteness, patient
    mobility). Cost captures estimated monetary expense in USD. Both are
    normalised 0–100 scores so they can be compared across action types.
    """

    friction_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Composite access-friction score (0 = frictionless, 100 = maximally difficult)",
    )
    cost_usd: float = Field(
        ..., ge=0, description="Estimated out-of-pocket or system cost in USD"
    )
    friction_rationale: str = Field(
        ...,
        description="Human-readable explanation of what drives the friction score",
    )
    cost_rationale: str = Field(
        ...,
        description="Human-readable explanation of the cost estimate",
    )


class Geometry(BaseModel):
    """GeoJSON-compatible LineString geometry for rendering on Mapbox.

    The `coordinates` list must contain at least two positions.  Each position
    is [longitude, latitude] — note GeoJSON uses lng-first order.

    Reference: https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.4
    """

    type: str = Field(
        "LineString",
        description="GeoJSON geometry type; always 'LineString' for route polylines",
    )
    coordinates: List[List[float]] = Field(
        ...,
        description="Ordered list of [lng, lat] positions defining the route path",
    )


class RouteResponse(BaseModel):
    """Axiom's routing decision returned to the front-end and/or orchestrating agent.

    Contains the recommended action, a plain-English rationale, a cost/friction
    analysis, and a GeoJSON geometry that Mapbox can render directly as a route
    layer.
    """

    selected_action: ActionEnum = Field(
        ..., description="The care-delivery action Axiom recommends for this patient"
    )
    rationale: str = Field(
        ...,
        description="Plain-English explanation of why this action was selected over alternatives",
    )
    cost_analysis: CostAnalysis = Field(
        ..., description="Friction vs monetary cost breakdown for the selected action"
    )
    geometry: Geometry = Field(
        ...,
        description="GeoJSON LineString of the recommended route for Mapbox visualisation",
    )
