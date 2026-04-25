"""
engine.py — Heuristic reinforcement-learning engine for Axiom routing.

The engine evaluates four care-delivery actions against a reward function:

    Reward = -(friction × FRICTION_WEIGHT) - (cost × COST_WEIGHT)

Higher (less negative) reward wins.  When urgency is 'high', friction is
tripled so the engine strongly favours actions that bring care to the patient
(MOBILE_UNIT) over actions that ask the patient to travel far.
"""

from dataclasses import dataclass

from constants import (
    COST_WEIGHT,
    FRICTION_WEIGHT,
    MATCH_WEIGHT,
    URGENCY_WEIGHT,
    HYBRID_CLINICS,
    MOBILE_DEPOTS,
    TRIAL_HUBS,
    TEST_KIT_COST,
    TEST_KIT_FRICTION,
)
from models import (
    ActionEnum,
    CostAnalysis,
    EmpathyMetrics,
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

    # STG-RL inputs from the Claude match analysis
    fragility_index: float = 0.5  # 0.0 = robust (ECOG 0) → 1.0 = fragile (ECOG 4)
    match_score: float = 50.0     # 0–100 trial match confidence


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
        fragility_index=(req.match_data.fragility_index if req.match_data else 0.5),
        match_score=(req.match_data.match_score if req.match_data else 50.0),
    )


# ---------------------------------------------------------------------------
# Per-action scoring
# ---------------------------------------------------------------------------

@dataclass
class ActionScore:
    """Raw scoring components before reward aggregation.

    friction       — Patient access friction (0–100).
    cost_usd       — Estimated dollar cost displayed to the researcher.
    cost_score     — Normalised operational cost (0–100) used in the reward.
    urgency_bonus  — Maximum urgency bonus this action can earn (0–100).
                     Applied at full weight only when urgency == 'high'.
    """

    action: ActionEnum
    friction: float
    cost_usd: float
    cost_score: float
    urgency_bonus: float
    friction_rationale: str
    cost_rationale: str


def calc_hub_score(state: State) -> ActionScore:
    """Score for HUB_FLIGHT.

    Patient friction: fixed at 100 (maximum exhaustion — long-distance travel).
    Operational cost: LOW — existing trial infrastructure is already in place.
    Urgency bonus: 0 — patient must travel; never the high-urgency gold standard.
    """
    return ActionScore(
        action=ActionEnum.HUB_FLIGHT,
        friction=100.0,
        cost_usd=150.0,
        cost_score=20.0,      # Low: leverages existing hub infrastructure
        urgency_bonus=0.0,
        friction_rationale=(
            f"Patient must travel {state.dist_to_hub_miles:.0f} mi to "
            f"{state.nearest_hub['name']} — maximum access friction (score 100/100)."
        ),
        cost_rationale=(
            "Low operational cost ($150) — trial leverages existing hub infrastructure."
        ),
    )


def calc_local_score(state: State) -> ActionScore:
    """Score for LOCAL_CLINIC.

    Patient friction: linear scale — distance_miles / 10.
      e.g. 5 mi → 0.5, 20 mi → 2.0, 100 mi → 10.0 (uncapped).
    Operational cost: MEDIUM — partner clinic fees.
    Urgency bonus: 0 — patient must travel; penalised under high urgency.
    """
    friction = state.dist_to_clinic_miles / 10.0
    return ActionScore(
        action=ActionEnum.LOCAL_CLINIC,
        friction=friction,
        cost_usd=250.0,
        cost_score=50.0,      # Medium: local partner clinic fees
        urgency_bonus=0.0,
        friction_rationale=(
            f"Nearest clinic ({state.nearest_clinic['name']}) is "
            f"{state.dist_to_clinic_miles:.1f} mi away — "
            f"friction score {friction:.2f} (distance ÷ 10)."
        ),
        cost_rationale=(
            "Medium operational cost ($250) — local partner clinic fees."
        ),
    )


def calc_mobile_score(state: State) -> ActionScore:
    """Score for MOBILE_UNIT.

    Patient friction: 0 — the unit travels to the patient (gold standard).
    Operational cost: HIGH — nurse salary, fuel, and equipment.
    Urgency bonus: 100 — maximally rewarded when urgency is high.
    """
    return ActionScore(
        action=ActionEnum.MOBILE_UNIT,
        friction=0.0,
        cost_usd=400.0,
        cost_score=80.0,      # High: nurse salary + fuel + equipment
        urgency_bonus=100.0,  # Gold standard — earns full urgency bonus
        friction_rationale=(
            f"Mobile unit dispatched from {state.nearest_depot['name']} "
            f"({state.dist_to_depot_miles:.1f} mi away) — zero patient friction."
        ),
        cost_rationale=(
            "High operational cost ($400) — nurse salary, fuel, and equipment."
        ),
    )


def calc_test_kit_score(state: State) -> ActionScore:
    """Score for TEST_KIT.

    Patient friction: minimal — patient receives and self-administers a kit at home.
    Operational cost: lowest — covers only courier shipping, no clinical overhead.
    Urgency bonus: 0 — not appropriate for high-urgency cases.
    Disqualified (score -9999) when urgency is 'high' because complex or
    time-sensitive conditions require an in-person assessment.
    """
    if state.urgency.lower() == "high":
        # Disqualify: urgent cases need hands-on care, not a mail-in kit.
        # Use maximum friction/cost (100/100) so the reward is always worse than
        # MOBILE_UNIT (+24 at high urgency) without breaching Pydantic's le=100 guard.
        return ActionScore(
            action=ActionEnum.TEST_KIT,
            friction=100.0,
            cost_usd=TEST_KIT_COST,
            cost_score=100.0,
            urgency_bonus=0.0,
            friction_rationale="Test kit disqualified — patient urgency is HIGH.",
            cost_rationale="Test kit disqualified — patient urgency is HIGH.",
        )

    return ActionScore(
        action=ActionEnum.TEST_KIT,
        friction=TEST_KIT_FRICTION,
        cost_usd=TEST_KIT_COST,
        cost_score=10.0,      # Lowest: shipping cost only
        urgency_bonus=0.0,
        friction_rationale=(
            f"Self-collection kit mailed directly to patient — "
            f"friction score {TEST_KIT_FRICTION}/100 (open a box at home)."
        ),
        cost_rationale=(
            f"Lowest operational cost (${TEST_KIT_COST}) — "
            "covers Axiom Express courier shipping only."
        ),
    )


# ---------------------------------------------------------------------------
# Reward function
# ---------------------------------------------------------------------------

def _reward(
    score: ActionScore,
    urgency: str,
    fragility_index: float = 0.5,
    match_score: float = 50.0,
) -> float:
    """Compute scalar reward for an ActionScore.

    Full STG-RL Bellman formula:

        R(s,a) = α·M_i  −  β·d(P_i,R_j)·F_i  −  γ·C_ops  [+ urgency bonus]

    Terms:
        α·M_i       — MATCH_WEIGHT × match_score: reward for capturing a
                       high-confidence trial match (higher score → more reward
                       for any action, but especially ones with low friction).
        β·d·F_i     — FRICTION_WEIGHT × friction × (1 + fragility_index):
                       the Empathy Penalty. A fragile patient (F_i → 1) doubles
                       the friction cost of travel-forcing actions, steering the
                       agent toward MOBILE_UNIT / TEST_KIT without hard rules.
        γ·C_ops     — COST_WEIGHT × cost_score: operational cost penalty.
        urgency bonus — URGENCY_WEIGHT × urgency_bonus when urgency == 'high'.

    A higher (less negative / more positive) reward is better.
    """
    match_bonus       = match_score    * MATCH_WEIGHT
    friction_penalty  = score.friction * FRICTION_WEIGHT * (1.0 + fragility_index)
    cost_penalty      = score.cost_score * COST_WEIGHT
    urgency_bonus_val = (
        score.urgency_bonus * URGENCY_WEIGHT if urgency.lower() == "high" else 0.0
    )
    return match_bonus - (friction_penalty + cost_penalty) + urgency_bonus_val


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
        calc_test_kit_score(state),
    ]
    scored = [(s, _reward(s, state.urgency, state.fragility_index, state.match_score)) for s in candidates]
    return max(scored, key=lambda x: x[1])


# ---------------------------------------------------------------------------
# Rationale generator
# ---------------------------------------------------------------------------

def _dropout_risk(action: ActionEnum, dist_to_clinic_miles: float) -> int:
    """Estimate trial-dropout risk percentage for the selected action.

    Heuristic:
      MOBILE_UNIT  — 0 % (care comes to the patient)
      LOCAL_CLINIC — 5 % base + 2 % per mile of driving distance
      HUB_FLIGHT   — 80 % (extreme travel burden)
    """
    if action == ActionEnum.MOBILE_UNIT:
        return 0
    if action == ActionEnum.TEST_KIT:
        return 0  # Kit delivered at home — no travel, no dropout pressure
    if action == ActionEnum.HUB_FLIGHT:
        return 80
    return min(int(5 + dist_to_clinic_miles * 2), 95)


def generate_rationale(score: ActionScore, reward: float, state: State) -> str:
    """Return a plain-English explanation of why this action was selected.

    Includes the reward score, contextual distance details, and a projected
    trial-dropout risk so researchers can audit the AI decision at a glance.
    """
    action = score.action
    urgency_clause = ""
    if state.urgency.lower() == "high":
        urgency_clause = (
            f" Patient urgency is HIGH and the nearest clinic is "
            f"{state.dist_to_clinic_miles:.1f} mi away"
        )
        if state.dist_to_clinic_miles > 20:
            urgency_clause += f" (>{20} mi threshold)"
        urgency_clause += "."

    risk = _dropout_risk(action, state.dist_to_clinic_miles)
    risk_clause = (
        f" Estimated trial-dropout risk: {risk}%."
        if risk > 0
        else " Estimated trial-dropout risk: 0% — care delivered at the patient's location."
    )

    action_label = {
        ActionEnum.MOBILE_UNIT:  "Mobile Unit Dispatch",
        ActionEnum.LOCAL_CLINIC: "Local Clinic Referral",
        ActionEnum.HUB_FLIGHT:   "Hub Flight Transport",
        ActionEnum.TEST_KIT:     "Self-Collection Test Kit",
    }[action]

    test_kit_clause = ""
    if action == ActionEnum.TEST_KIT:
        test_kit_clause = (
            " Medical match confirmed. A self-collection kit has been dispatched "
            "via Axiom Express. Tracking ID: AX-42881. Please check the Patient "
            "Portal for a step-by-step video guide."
        )

    return (
        f"Selected {action_label} (reward {reward:.2f}).{urgency_clause} "
        f"{score.friction_rationale} {score.cost_rationale}{risk_clause}"
        f"{test_kit_clause}"
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

    # Resolve facility for the selected action.
    # TEST_KIT uses the nearest hub as the dispatch origin (kit mailed from hub).
    action = best_score.action
    facility_map = {
        ActionEnum.HUB_FLIGHT:   state.nearest_hub,
        ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
        ActionEnum.MOBILE_UNIT:  state.nearest_depot,
        ActionEnum.TEST_KIT:     state.nearest_hub,
    }
    facility = facility_map[action]
    patient  = (state.patient_lat, state.patient_lng)

    waypoints = build_route_geometry(
        action=action.value,
        patient=patient,
        facility=facility,
        num_points=20,
    )

    # Empathy metrics: compare patient travel against hub-flight baseline
    travel_saved = {
        ActionEnum.HUB_FLIGHT:   0.0,
        ActionEnum.LOCAL_CLINIC: max(0.0, state.dist_to_hub_miles - state.dist_to_clinic_miles),
        ActionEnum.MOBILE_UNIT:  state.dist_to_hub_miles,
        ActionEnum.TEST_KIT:     state.dist_to_hub_miles,
    }[action]

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
        empathy_metrics=EmpathyMetrics(
            patient_travel_saved_miles=round(travel_saved, 1),
            fragility_accommodated=action in (ActionEnum.MOBILE_UNIT, ActionEnum.TEST_KIT),
            match_score=state.match_score,
            dropout_risk_pct=_dropout_risk(action, state.dist_to_clinic_miles),
        ),
    )
