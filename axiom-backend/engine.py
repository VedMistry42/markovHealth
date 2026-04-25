"""
engine.py — markovHealth RL logistics engine.

Reward function (per the system spec):

    R(s, a) = α·M_i  −  β·d(P_i, R_j)·F_i  −  γ·C_ops

Where:
    α  = MATCH_WEIGHT    — reward for capturing a high-confidence matched patient
    M_i = match_score    — AI confidence 0-100
    β  = EMPATHY_WEIGHT  — penalty weight on travel × fragility
    d  = geodesic miles between patient and assigned facility
    F_i = fragility_index (0=fit, 1=fully fragile; derived from ECOG/4)
    γ  = COST_WEIGHT     — penalty on operational cost
    C_ops = cost_usd     — estimated operational cost

High urgency activates a bonus that further rewards zero-friction actions
(MOBILE_UNIT), preventing the engine from choosing cheap hub routing when
the patient is fragile and can't travel.

Entropy maximisation (SAC-inspired) is approximated by a small stochastic
noise term added to each reward draw — this breaks ties away from the
greedy hub-always solution and surfaces non-standard routes.
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


# ---------------------------------------------------------------------------
# Internal state snapshot
# ---------------------------------------------------------------------------

@dataclass
class State:
    patient_lat: float
    patient_lng: float
    urgency:     str
    is_match:    bool
    match_score: float        # α·M term input
    fragility:   float        # F_i  ∈ [0, 1]

    nearest_hub:    dict
    nearest_clinic: dict
    nearest_depot:  dict

    dist_to_hub_miles:    float
    dist_to_clinic_miles: float
    dist_to_depot_miles:  float


def _build_state(req: PatientRequest) -> State:
    origin = (req.patient_coords.lat, req.patient_coords.lng)

    # If fragility not explicitly set, derive from ECOG if present
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


# ---------------------------------------------------------------------------
# Per-action scoring
# ---------------------------------------------------------------------------

@dataclass
class ActionScore:
    action:              ActionEnum
    reward:              float    # Final R(s,a) value
    cost_usd:            float
    friction_score:      float    # 0-100 normalised patient friction
    empathy_penalty:     float    # β·d·F actual value
    match_term:          float    # α·M actual value
    cost_term:           float    # γ·C actual value
    friction_rationale:  str
    cost_rationale:      str
    dist_miles:          float    # distance patient travels (or 0 if unit comes to them)
    travel_time_mins:    float


def _reward(match_term: float, empathy_penalty: float, cost_term: float,
            urgency: str, is_mobile: bool) -> float:
    """
    R(s, a) = α·M  −  β·d·F  −  γ·C  [+ urgency_bonus if high urgency & mobile]

    SAC-inspired entropy: add small uniform noise to prevent deterministic
    collapse to the closest-hub greedy policy.
    """
    base = match_term - empathy_penalty - cost_term
    if urgency.lower() == "high" and is_mobile:
        base += URGENCY_BONUS
    # Entropy regularisation (ε ~ Uniform[-0.5, 0.5])
    base += random.uniform(-0.5, 0.5)
    return base


def score_hub_flight(state: State) -> ActionScore:
    """
    HUB_FLIGHT: patient must travel to major hub hospital.

    Empathy Penalty is maximised here because the patient travels the longest
    distance and high fragility (ECOG ≥ 2) makes this extremely costly.
    """
    d    = state.dist_to_hub_miles
    F    = state.fragility
    M    = state.match_score
    cost = 150.0   # low operational cost — existing infrastructure

    match_term     = MATCH_WEIGHT * M
    empathy_penalty = EMPATHY_WEIGHT * d * F
    cost_term      = COST_WEIGHT * cost
    reward         = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=False)

    # Friction 0-100: hub always maximal because patient must travel farthest
    friction = min(100.0, (d / 5.0) * F * 100)

    return ActionScore(
        action=ActionEnum.HUB_FLIGHT,
        reward=reward,
        cost_usd=cost,
        friction_score=friction,
        empathy_penalty=empathy_penalty,
        match_term=match_term,
        cost_term=cost_term,
        friction_rationale=(
            f"Patient must travel {d:.0f} mi to {state.nearest_hub['name']}. "
            f"Fragility F={F:.2f} → Empathy Penalty={empathy_penalty:.1f}."
        ),
        cost_rationale="Low cost ($150) — uses existing hub infrastructure.",
        dist_miles=d,
        travel_time_mins=estimate_travel_time(d, mode="flight") if d > 200 else estimate_travel_time(d, mode="car"),
    )


def score_local_clinic(state: State) -> ActionScore:
    """
    LOCAL_CLINIC: patient drives to nearest hybrid community clinic.

    Empathy Penalty scales with distance and fragility — a fragile patient
    driving 30+ miles still incurs a significant penalty.
    """
    d    = state.dist_to_clinic_miles
    F    = state.fragility
    M    = state.match_score
    cost = 250.0

    match_term      = MATCH_WEIGHT * M
    empathy_penalty = EMPATHY_WEIGHT * d * F
    cost_term       = COST_WEIGHT * cost
    reward          = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=False)

    friction = min(100.0, (d / 2.0) * (1 + F))

    return ActionScore(
        action=ActionEnum.LOCAL_CLINIC,
        reward=reward,
        cost_usd=cost,
        friction_score=friction,
        empathy_penalty=empathy_penalty,
        match_term=match_term,
        cost_term=cost_term,
        friction_rationale=(
            f"Nearest clinic ({state.nearest_clinic['name']}) is {d:.1f} mi away. "
            f"F={F:.2f} → Empathy Penalty={empathy_penalty:.1f}."
        ),
        cost_rationale="Medium cost ($250) — local partner clinic fees.",
        dist_miles=d,
        travel_time_mins=estimate_travel_time(d, mode="car"),
    )


def score_mobile_unit(state: State) -> ActionScore:
    """
    MOBILE_UNIT: unit dispatched to patient's location — zero patient travel.

    Because d_patient = 0, the Empathy Penalty is always 0 regardless of
    fragility. This is the mathematically correct representation of "care
    comes to you." Operational cost is highest (nurse, fuel, equipment).
    """
    d_depot = state.dist_to_depot_miles   # depot → patient distance (operational)
    F       = state.fragility
    M       = state.match_score
    cost    = 400.0

    match_term      = MATCH_WEIGHT * M
    empathy_penalty = 0.0           # patient travels 0 miles
    cost_term       = COST_WEIGHT * cost
    reward          = _reward(match_term, empathy_penalty, cost_term, state.urgency, is_mobile=True)

    return ActionScore(
        action=ActionEnum.MOBILE_UNIT,
        reward=reward,
        cost_usd=cost,
        friction_score=0.0,       # zero patient friction
        empathy_penalty=0.0,
        match_term=match_term,
        cost_term=cost_term,
        friction_rationale=(
            f"Mobile unit dispatched from {state.nearest_depot['name']} "
            f"({d_depot:.1f} mi away) — zero patient travel. "
            f"F={F:.2f} fully accommodated."
        ),
        cost_rationale="High cost ($400) — nurse salary, fuel, equipment.",
        dist_miles=0.0,
        travel_time_mins=estimate_travel_time(d_depot, mode="car"),
    )


# ---------------------------------------------------------------------------
# Policy selection
# ---------------------------------------------------------------------------

def select_best_action(state: State) -> tuple[ActionScore, ActionScore, ActionScore]:
    """Score all three actions and return (best, second, worst) by reward."""
    candidates = [
        score_hub_flight(state),
        score_local_clinic(state),
        score_mobile_unit(state),
    ]
    ranked = sorted(candidates, key=lambda s: s.reward, reverse=True)
    return ranked[0], ranked[1], ranked[2]


# ---------------------------------------------------------------------------
# Rationale
# ---------------------------------------------------------------------------

def generate_rationale(best: ActionScore, state: State) -> str:
    action_label = {
        ActionEnum.MOBILE_UNIT:  "Mobile Unit Dispatch",
        ActionEnum.LOCAL_CLINIC: "Local Clinic Referral",
        ActionEnum.HUB_FLIGHT:   "Hub Flight Transport",
    }[best.action]

    fragility_clause = ""
    if state.fragility >= 0.5:
        fragility_clause = (
            f" Patient fragility F={state.fragility:.2f} (≥0.5) triggered the "
            f"Empathy Penalty — travel-heavy options were heavily penalised."
        )

    dropout_risk = {
        ActionEnum.MOBILE_UNIT:  "0% (care delivered at patient location)",
        ActionEnum.LOCAL_CLINIC: f"{min(95, int(5 + state.dist_to_clinic_miles * 2))}%",
        ActionEnum.HUB_FLIGHT:   "80%",
    }[best.action]

    return (
        f"Selected {action_label} (R={best.reward:.2f}). "
        f"α·M={best.match_term:.1f}, β·d·F={best.empathy_penalty:.1f}, γ·C={best.cost_term:.1f}."
        f"{fragility_clause} "
        f"{best.friction_rationale} "
        f"Estimated trial-dropout risk: {dropout_risk}."
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def evaluate_logistics(req: PatientRequest) -> RouteResponse:
    """Full RL evaluation pipeline → RouteResponse."""
    state = _build_state(req)
    best, second, worst = select_best_action(state)

    # Facility for route geometry
    facility_map = {
        ActionEnum.HUB_FLIGHT:   state.nearest_hub,
        ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
        ActionEnum.MOBILE_UNIT:  state.nearest_depot,
    }
    facility = facility_map[best.action]
    patient  = (state.patient_lat, state.patient_lng)

    waypoints = build_route_geometry(
        action=best.action.value,
        patient=patient,
        facility=facility,
        num_points=20,
    )

    rationale = generate_rationale(best, state)

    # Empathy metrics
    worst_dist  = worst.dist_miles
    travel_saved = round(worst_dist - best.dist_miles, 1)
    fragility_accommodated = (state.fragility >= 0.5 and best.action == ActionEnum.MOBILE_UNIT)

    empathy = EmpathyMetrics(
        patient_travel_saved_miles=max(0.0, travel_saved),
        fragility_accommodated=fragility_accommodated,
        empathy_penalty_applied=best.empathy_penalty,
        best_vs_worst_reward_delta=round(best.reward - worst.reward, 2),
    )

    # GeoJSON Feature for logistics plan
    route_feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": waypoints,
        },
        "properties": {
            "action": best.action.value,
            "patient_id": req.patient_id,
            "facility_name": facility.get("name", ""),
        },
    }

    mins = best.travel_time_mins
    if mins < 60:
        time_str = f"{int(mins)} mins"
    else:
        time_str = f"{int(mins // 60)}h {int(mins % 60)}m"

    logistics_plan = LogisticsPlan(
        decision=best.action.value,
        route=route_feature,
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
