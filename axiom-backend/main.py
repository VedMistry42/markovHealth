from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from constants import (
    COST_WEIGHT,
    FRICTION_WEIGHT,
    HYBRID_CLINICS,
    MOBILE_DEPOTS,
    TRIAL_HUBS,
)
from engine import (
    _build_state,
    _reward,
    calc_hub_score,
    calc_local_score,
    calc_mobile_score,
    evaluate_logistics,
)
from models import ActionEnum, CostAnalysis, Geometry, PatientRequest, RouteResponse
from utils import build_route_geometry

app = FastAPI(title="Axiom Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Core routing endpoint
# ---------------------------------------------------------------------------

@app.post("/calculate-route", response_model=RouteResponse)
def calculate_route(
    req: PatientRequest,
    force_action: Optional[ActionEnum] = Query(
        None,
        description=(
            "Demo override: force a specific action regardless of reward scores. "
            "Useful for showcasing a particular route type (e.g. MOBILE_UNIT truck icon)."
        ),
    ),
) -> RouteResponse:
    """Evaluate all three care-delivery actions and return the best route.

    Pass `?force_action=MOBILE_UNIT` (or HUB_FLIGHT / LOCAL_CLINIC) to bypass
    the reward engine and hard-code a specific action for demo purposes.

    Returns 400 if the patient is not flagged as a trial match.
    """
    print("\n" + "=" * 60)
    print(f"[AXIOM] New request  patient_id={req.patient_id}")
    print(f"[AXIOM] Coords       lat={req.patient_coords.lat}  lng={req.patient_coords.lng}")
    print(f"[AXIOM] is_match={req.is_match}  force_action={force_action}")

    # --- Guard: non-match patients are not routed ---
    if not req.is_match:
        print("[AXIOM] ✗ Patient not eligible — returning 400")
        raise HTTPException(
            status_code=400,
            detail="Patient not eligible for this trial.",
        )

    print(f"[AXIOM] match_data   condition={req.match_data.condition!r}  urgency={req.match_data.urgency!r}")

    # --- Build world-state ---
    state = _build_state(req)
    print(f"\n[AXIOM] Nearest hub    : {state.nearest_hub['name']}  ({state.dist_to_hub_miles:.1f} mi)")
    print(f"[AXIOM] Nearest clinic : {state.nearest_clinic['name']}  ({state.dist_to_clinic_miles:.1f} mi)")
    print(f"[AXIOM] Nearest depot  : {state.nearest_depot['name']}  ({state.dist_to_depot_miles:.1f} mi)")

    # --- Score all three actions (always computed for the reward log) ---
    hub_score    = calc_hub_score(state)
    local_score  = calc_local_score(state)
    mobile_score = calc_mobile_score(state)

    r_hub    = _reward(hub_score,    state.urgency)
    r_local  = _reward(local_score,  state.urgency)
    r_mobile = _reward(mobile_score, state.urgency)

    urgency_note = "  ← UrgencyBonus active (HIGH urgency)" if state.urgency.lower() == "high" else ""
    print(f"\n[AXIOM] Reward scores  (higher = better){urgency_note}")
    print(f"[AXIOM]   HUB_FLIGHT   friction={hub_score.friction:6.2f}  cost_score={hub_score.cost_score:5.0f}  urgency_bonus={hub_score.urgency_bonus:5.0f}  reward={r_hub:8.2f}")
    print(f"[AXIOM]   LOCAL_CLINIC friction={local_score.friction:6.2f}  cost_score={local_score.cost_score:5.0f}  urgency_bonus={local_score.urgency_bonus:5.0f}  reward={r_local:8.2f}")
    print(f"[AXIOM]   MOBILE_UNIT  friction={mobile_score.friction:6.2f}  cost_score={mobile_score.cost_score:5.0f}  urgency_bonus={mobile_score.urgency_bonus:5.0f}  reward={r_mobile:8.2f}")

    # --- Demo override: bypass engine and force a specific action ---
    if force_action is not None:
        print(f"\n[AXIOM] ⚡ DEMO OVERRIDE — forcing action: {force_action.value}")
        score_map = {
            ActionEnum.HUB_FLIGHT:   hub_score,
            ActionEnum.LOCAL_CLINIC: local_score,
            ActionEnum.MOBILE_UNIT:  mobile_score,
        }
        reward_map = {
            ActionEnum.HUB_FLIGHT:   r_hub,
            ActionEnum.LOCAL_CLINIC: r_local,
            ActionEnum.MOBILE_UNIT:  r_mobile,
        }
        forced_score  = score_map[force_action]
        forced_reward = reward_map[force_action]
        facility_map = {
            ActionEnum.HUB_FLIGHT:   state.nearest_hub,
            ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
            ActionEnum.MOBILE_UNIT:  state.nearest_depot,
        }
        facility  = facility_map[force_action]
        patient   = (state.patient_lat, state.patient_lng)
        waypoints = build_route_geometry(
            action=force_action.value,
            patient=patient,
            facility=facility,
            num_points=20,
        )
        from engine import generate_rationale
        rationale = (
            f"[DEMO OVERRIDE] {generate_rationale(forced_score, forced_reward, state)}"
        )
        response = RouteResponse(
            selected_action=force_action,
            rationale=rationale,
            cost_analysis=CostAnalysis(
                friction_score=forced_score.friction,
                cost_usd=forced_score.cost_usd,
                friction_rationale=forced_score.friction_rationale,
                cost_rationale=forced_score.cost_rationale,
            ),
            geometry=Geometry(type="LineString", coordinates=waypoints),
        )
        print(f"[AXIOM] ✓ Forced       {response.selected_action.value}")
        print("=" * 60 + "\n")
        return response

    # --- Normal evaluation ---
    response = evaluate_logistics(req)
    print(f"\n[AXIOM] ✓ Decision     {response.selected_action.value}")
    print(f"[AXIOM] Rationale      {response.rationale[:120]}…")
    print("=" * 60 + "\n")

    return response
