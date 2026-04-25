"""
engine.py — markovHealth RL logistics engine.

Reward function (system spec):

    R(s, a) = α·M_i  −  β·d(P_i, R_j)·F_i  −  γ·C_ops

    α  = MATCH_WEIGHT      reward for capturing a high-confidence matched patient
    M_i = match_score      AI confidence 0-100
    β  = EMPATHY_WEIGHT    penalty weight for travel × fragility
    d  = geodesic miles between patient and assigned facility
    F_i = fragility_index  (0=fit, 1=maximally fragile; ECOG/4)
    γ  = COST_WEIGHT       penalty on operational expense
    C_ops = cost_usd       estimated operational cost in USD

Key insight: MOBILE_UNIT always has d_patient = 0, so the Empathy Penalty
β·d·F is always 0 regardless of fragility. This is the mathematical proof
that "care comes to you." High-urgency patients receive an additional
URGENCY_BONUS on top of the mobile unit reward.

SAC-inspired entropy: uniform noise ε∈[-0.5,0.5] prevents deterministic
collapse to the closest-hub greedy policy.
"""

import math
import random
from dataclasses import dataclass

from constants import (
    COST_WEIGHT,
    EMPATHY_WEIGHT,
    MATCH_WEIGHT,
    URGENCY_BONUS,
    HYBRID_CLINICS,
    MOBILE_DEPOTS,
    TRIAL_HUBS,
)
from models import (
    ActionEnum,
    CostAnalysis,
    EmpathyMetrics,
    Geometry,
    LogisticsPlan,
    PatientRequest,
    RouteResponse,
)
from utils import (
    build_route_geometry,
    calculate_distance,
    estimate_travel_time,
    find_nearest_clinic,
    find_nearest_depot,
    find_nearest_hub,
)


@dataclass
class State:
    patient_lat: float
    patient_lng: float
    urgency:     str
    is_match:    bool
    match_score: float
    fragility:   float
    nearest_hub:    dict
    nearest_clinic: dict
    nearest_depot:  dict
    dist_to_hub_miles:    float
    dist_to_clinic_miles: float
    dist_to_depot_miles:  float


def _build_state(req: PatientRequest) -> State:
    origin = (req.patient_coords.lat, req.patient_coords.lng)

    fragility = req.fragility_index
    if req.match_data and req.match_data.ecog_status is not None:
        fragility = req.match_data.ecog_status / 4.0

    hub    = find_nearest_hub(origin, TRIAL_HUBS)
    clinic = find_nearest_clinic(origin, HYBRID_CLINICS)
    depot  = find_nearest_depot(origin, MOBILE_DEPOTS)

    return State(
        patient_lat=req.patient_coords.lat,
        patient_lng=req.patient_coords.lng,
        urgency=(req.match_data.urgency if req.match_data else "low"),
        is_match=req.is_match,
        match_score=req.match_score,
        fragility=fragility,
        nearest_hub=hub,
        nearest_clinic=clinic,
        nearest_depot=depot,
        dist_to_hub_miles=calculate_distance(origin, (hub["lat"], hub["lng"])),
        dist_to_clinic_miles=calculate_distance(origin, (clinic["lat"], clinic["lng"])),
        dist_to_depot_miles=calculate_distance(origin, (depot["lat"], depot["lng"])),
    )


@dataclass
class ActionScore:
    action:              ActionEnum
    reward:              float
    cost_usd:            float
    friction_score:      float
    empathy_penalty:     float
    match_term:          float
    cost_term:           float
    friction_rationale:  str
    cost_rationale:      str
    dist_miles:          float
    travel_time_mins:    float


def _reward(match_term: float, empathy_penalty: float, cost_term: float,
            urgency: str, is_mobile: bool) -> float:
    base = match_term - empathy_penalty - cost_term
    if urgency.lower() == "high" and is_mobile:
        base += URGENCY_BONUS
    base += random.uniform(-0.5, 0.5)  # SAC entropy regularisation
    return base


def score_hub_flight(state: State) -> ActionScore:
    d    = state.dist_to_hub_miles
    F    = state.fragility
    M    = state.match_score
    cost = 150.0

    match_term      = MATCH_WEIGHT * M
    empathy_penalty = EMPATHY_WEIGHT * d * F
    cost_term       = COST_WEIGHT * cost
    reward          = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=False)
    friction        = min(100.0, (d / 5.0) * F * 100)

    return ActionScore(
        action=ActionEnum.HUB_FLIGHT,
        reward=reward, cost_usd=cost,
        friction_score=friction,
        empathy_penalty=empathy_penalty,
        match_term=match_term, cost_term=cost_term,
        friction_rationale=(
            f"Patient must travel {d:.0f} mi to {state.nearest_hub['name']}. "
            f"F={F:.2f} → β·d·F={empathy_penalty:.1f}."
        ),
        cost_rationale="Low ($150) — existing hub infrastructure.",
        dist_miles=d,
        travel_time_mins=estimate_travel_time(d, mode="flight" if d > 200 else "car"),
    )


def score_local_clinic(state: State) -> ActionScore:
    d    = state.dist_to_clinic_miles
    F    = state.fragility
    M    = state.match_score
    cost = 250.0

    match_term      = MATCH_WEIGHT * M
    empathy_penalty = EMPATHY_WEIGHT * d * F
    cost_term       = COST_WEIGHT * cost
    reward          = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=False)
    friction        = min(100.0, (d / 2.0) * (1 + F))

    return ActionScore(
        action=ActionEnum.LOCAL_CLINIC,
        reward=reward, cost_usd=cost,
        friction_score=friction,
        empathy_penalty=empathy_penalty,
        match_term=match_term, cost_term=cost_term,
        friction_rationale=(
            f"Nearest clinic ({state.nearest_clinic['name']}) is {d:.1f} mi away. "
            f"F={F:.2f} → β·d·F={empathy_penalty:.1f}."
        ),
        cost_rationale="Medium ($250) — local partner clinic fees.",
        dist_miles=d,
        travel_time_mins=estimate_travel_time(d, mode="car"),
    )


def score_mobile_unit(state: State) -> ActionScore:
    """
    MOBILE_UNIT: unit dispatched to patient — d_patient = 0.
    Empathy Penalty is always 0 because the patient travels zero miles.
    """
    d_depot = state.dist_to_depot_miles
    F       = state.fragility
    M       = state.match_score
    cost    = 400.0

    match_term      = MATCH_WEIGHT * M
    empathy_penalty = 0.0  # patient travels 0 miles
    cost_term       = COST_WEIGHT * cost
    reward          = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=True)

    return ActionScore(
        action=ActionEnum.MOBILE_UNIT,
        reward=reward, cost_usd=cost,
        friction_score=0.0,
        empathy_penalty=0.0,
        match_term=match_term, cost_term=cost_term,
        friction_rationale=(
            f"Mobile unit from {state.nearest_depot['name']} ({d_depot:.1f} mi). "
            f"Zero patient travel. F={F:.2f} fully accommodated."
        ),
        cost_rationale="High ($400) — nurse, fuel, equipment.",
        dist_miles=0.0,
        travel_time_mins=estimate_travel_time(d_depot, mode="car"),
    )


def evaluate_logistics(req: PatientRequest) -> RouteResponse:
    state = _build_state(req)

    candidates = [score_hub_flight(state), score_local_clinic(state), score_mobile_unit(state)]
    ranked = sorted(candidates, key=lambda s: s.reward, reverse=True)
    best, _, worst = ranked[0], ranked[1], ranked[2]

    facility_map = {
        ActionEnum.HUB_FLIGHT:   state.nearest_hub,
        ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
        ActionEnum.MOBILE_UNIT:  state.nearest_depot,
    }
    facility  = facility_map[best.action]
    patient   = (state.patient_lat, state.patient_lng)
    waypoints = build_route_geometry(best.action.value, patient, facility, num_points=20)

    rationale = (
        f"Selected {best.action.value} (R={best.reward:.2f}). "
        f"α·M={best.match_term:.1f}, β·d·F={best.empathy_penalty:.1f}, γ·C={best.cost_term:.1f}. "
        f"{best.friction_rationale} "
        f"Trial-dropout risk: {'0% (on-site)' if best.action == ActionEnum.MOBILE_UNIT else 'reduced'}."
    )

    travel_saved = round(worst.dist_miles - best.dist_miles, 1)
    fragility_accommodated = (state.fragility >= 0.5 and best.action == ActionEnum.MOBILE_UNIT)

    empathy = EmpathyMetrics(
        patient_travel_saved_miles=max(0.0, travel_saved),
        fragility_accommodated=fragility_accommodated,
        empathy_penalty_applied=best.empathy_penalty,
        best_vs_worst_reward_delta=round(best.reward - worst.reward, 2),
    )

    mins = best.travel_time_mins
    time_str = f"{int(mins)} mins" if mins < 60 else f"{int(mins//60)}h {int(mins%60)}m"

    logistics_plan = LogisticsPlan(
        decision=best.action.value,
        route={
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": waypoints},
            "properties": {"action": best.action.value, "patient_id": req.patient_id},
        },
        estimated_time=time_str,
        empathy_metrics=empathy,
    )

    return RouteResponse(
        selected_action=best.action,
        rationale=rationale,
        cost_analysis=CostAnalysis(
            friction_score=best.friction_score,
            cost_usd=best.cost_usd,
            empathy_penalty=best.empathy_penalty,
            friction_rationale=best.friction_rationale,
            cost_rationale=best.cost_rationale,
        ),
        geometry=Geometry(type="LineString", coordinates=waypoints),
        logistics_plan=logistics_plan,
    )
