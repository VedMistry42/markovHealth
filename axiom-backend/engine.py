"""
engine.py — Heuristic reinforcement-learning engine for Axiom routing.

The engine evaluates three care-delivery actions against a reward function:

    Reward = -(friction × FRICTION_WEIGHT) - (cost × COST_WEIGHT)

Higher (less negative) reward wins.  When urgency is 'high', friction is
tripled so the engine strongly favours actions that bring care to the patient
(MOBILE_UNIT) over actions that ask the patient to travel far.
"""

from dataclasses import dataclass

from constants import (
    COST_WEIGHT,
    FRICTION_WEIGHT,
    HYBRID_CLINICS,
    MOBILE_DEPOTS,
    TRIAL_HUBS,
)
from models import (
    ActionEnum,
    CostAnalysis,
    Geometry,
    PatientRequest,
    RouteResponse,
)
from utils import (
    build_route_geometry,
    calculate_distance,
    find_nearest_clinic,
    find_nearest_depot,
    find_nearest_hub,
)


# ---------------------------------------------------------------------------
# Internal state snapshot
# ---------------------------------------------------------------------------

@dataclass
class State:
    """Derived world-state computed from a PatientRequest.

    Bundles distances and nearest-facility references so each scoring
    function receives a single, consistent view of the environment.
    """

    patient_lat: float
    patient_lng: float
    urgency: str                  # 'high' | 'medium' | 'low' (or any string)
    is_match: bool

    nearest_hub: dict
    nearest_clinic: dict
    nearest_depot: dict

    dist_to_hub_miles: float
    dist_to_clinic_miles: float
    dist_to_depot_miles: float


def _build_state(req: PatientRequest) -> State:
    """Derive State from an inbound PatientRequest."""
    origin = (req.patient_coords.lat, req.patient_coords.lng)

    hub    = find_nearest_hub(origin, TRIAL_HUBS)
    clinic = find_nearest_clinic(origin, HYBRID_CLINICS)
    depot  = find_nearest_depot(origin, MOBILE_DEPOTS)

    return State(
        patient_lat=req.patient_coords.lat,
        patient_lng=req.patient_coords.lng,
        urgency=(req.match_data.urgency if req.match_data else "low"),
        is_match=req.is_match,
        nearest_hub=hub,
        nearest_clinic=clinic,
        nearest_depot=depot,
        dist_to_hub_miles=calculate_distance(origin, (hub["lat"], hub["lng"])),
        dist_to_clinic_miles=calculate_distance(origin, (clinic["lat"], clinic["lng"])),
        dist_to_depot_miles=calculate_distance(origin, (depot["lat"], depot["lng"])),
    )


# ---------------------------------------------------------------------------
# Per-action scoring
# ---------------------------------------------------------------------------

@dataclass
class ActionScore:
    """Raw friction / cost components before reward aggregation."""

    action: ActionEnum
    friction: float
    cost_usd: float
    friction_rationale: str
    cost_rationale: str


def calc_hub_score(state: State) -> ActionScore:
    """Score for HUB_FLIGHT.

    Fixed maximum friction (patient must travel far to a major hub) and a
    high fixed operational cost reflecting air transport logistics.
    """
    return ActionScore(
        action=ActionEnum.HUB_FLIGHT,
        friction=100.0,
        cost_usd=500.0,
        friction_rationale=(
            f"Patient must travel {state.dist_to_hub_miles:.0f} mi to "
            f"{state.nearest_hub['name']} — maximum access friction."
        ),
        cost_rationale="Air transport and hub-hospital admission estimated at $500.",
    )


def calc_local_score(state: State) -> ActionScore:
    """Score for LOCAL_CLINIC.

    Friction scales linearly with distance (2 friction-points per mile) so
    a clinic 10 miles away scores 20, and 50 miles scores 100.  Cost is a
    fixed medium value representing a standard clinic visit.
    """
    friction = min(state.dist_to_clinic_miles * 2.0, 100.0)
    return ActionScore(
        action=ActionEnum.LOCAL_CLINIC,
        friction=friction,
        cost_usd=100.0,
        friction_rationale=(
            f"Nearest clinic ({state.nearest_clinic['name']}) is "
            f"{state.dist_to_clinic_miles:.1f} mi away — "
            f"friction score {friction:.0f}/100."
        ),
        cost_rationale="Standard clinic visit estimated at $100.",
    )


def calc_mobile_score(state: State) -> ActionScore:
    """Score for MOBILE_UNIT.

    Zero patient friction — the unit comes to them.  Operational cost is
    higher than a clinic visit due to dispatch overhead.
    """
    return ActionScore(
        action=ActionEnum.MOBILE_UNIT,
        friction=0.0,
        cost_usd=300.0,
        friction_rationale=(
            f"Mobile unit dispatched from {state.nearest_depot['name']} "
            f"({state.dist_to_depot_miles:.1f} mi away) — zero patient friction."
        ),
        cost_rationale="Mobile unit dispatch and staffing estimated at $300.",
    )


# ---------------------------------------------------------------------------
# Reward function
# ---------------------------------------------------------------------------

def _reward(score: ActionScore, urgency: str) -> float:
    """Compute scalar reward for an ActionScore.

    Formula:
        friction_penalty = friction × FRICTION_WEIGHT
        If urgency == 'high': friction_penalty × 3   (urgency multiplier)
        reward = -friction_penalty - (cost × COST_WEIGHT)

    A higher (less negative) reward is better.
    """
    friction_penalty = score.friction * FRICTION_WEIGHT
    if urgency.lower() == "high":
        friction_penalty *= 3.0
    cost_penalty = score.cost_usd * COST_WEIGHT
    return -(friction_penalty + cost_penalty)


# ---------------------------------------------------------------------------
# Action selection
# ---------------------------------------------------------------------------

def select_best_action(state: State) -> tuple[ActionScore, float]:
    """Iterate over all action scores and return the highest-reward option.

    Returns:
        (best_ActionScore, best_reward_value)
    """
    candidates = [
        calc_hub_score(state),
        calc_local_score(state),
        calc_mobile_score(state),
    ]
    scored = [(s, _reward(s, state.urgency)) for s in candidates]
    return max(scored, key=lambda x: x[1])


# ---------------------------------------------------------------------------
# Rationale generator
# ---------------------------------------------------------------------------

def generate_rationale(score: ActionScore, reward: float, state: State) -> str:
    """Return a plain-English explanation of why this action was selected.

    Written to be interpretable by both end-users and downstream AI agents.
    """
    urgency_note = (
        " Clinical urgency is HIGH — friction weight tripled to prioritise "
        "minimising patient travel."
        if state.urgency.lower() == "high"
        else ""
    )
    return (
        f"Selected {score.action.value} with reward score {reward:.2f}. "
        f"{score.friction_rationale} {score.cost_rationale}{urgency_note}"
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def evaluate_logistics(req: PatientRequest) -> RouteResponse:
    """Main routing entry point — converts a PatientRequest into a RouteResponse.

    Pipeline:
        1. Build world-state from request.
        2. Score all three actions.
        3. Select highest-reward action.
        4. Generate rationale string.
        5. Build GeoJSON Bézier geometry for Mapbox.
        6. Return a fully-populated RouteResponse.

    Args:
        req: Inbound patient routing request.

    Returns:
        RouteResponse ready to be serialised and returned by the FastAPI endpoint.
    """
    state = _build_state(req)
    best_score, best_reward = select_best_action(state)

    # Resolve facility for the selected action
    action = best_score.action
    facility_map = {
        ActionEnum.HUB_FLIGHT:   state.nearest_hub,
        ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
        ActionEnum.MOBILE_UNIT:  state.nearest_depot,
    }
    facility = facility_map[action]
    patient  = (state.patient_lat, state.patient_lng)

    waypoints = build_route_geometry(
        action=action.value,
        patient=patient,
        facility=facility,
        num_points=20,
    )

    return RouteResponse(
        selected_action=action,
        rationale=generate_rationale(best_score, best_reward, state),
        cost_analysis=CostAnalysis(
            friction_score=best_score.friction,
            cost_usd=best_score.cost_usd,
            friction_rationale=best_score.friction_rationale,
            cost_rationale=best_score.cost_rationale,
        ),
        geometry=Geometry(type="LineString", coordinates=waypoints),
    )
