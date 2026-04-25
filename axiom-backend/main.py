from fastapi import FastAPI, HTTPException
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
from models import PatientRequest, RouteResponse

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
def calculate_route(req: PatientRequest) -> RouteResponse:
    """Evaluate all three care-delivery actions and return the best route.

    Returns 400 if the patient is not flagged as a trial match, since routing
    them to a hub or mobile unit would be clinically inappropriate.
    """
    print("\n" + "=" * 60)
    print(f"[AXIOM] New request  patient_id={req.patient_id}")
    print(f"[AXIOM] Coords       lat={req.patient_coords.lat}  lng={req.patient_coords.lng}")
    print(f"[AXIOM] is_match={req.is_match}")

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

    # --- Score all three actions ---
    hub_score    = calc_hub_score(state)
    local_score  = calc_local_score(state)
    mobile_score = calc_mobile_score(state)

    r_hub    = _reward(hub_score,    state.urgency)
    r_local  = _reward(local_score,  state.urgency)
    r_mobile = _reward(mobile_score, state.urgency)

    urgency_note = "  ← friction ×3 (HIGH urgency)" if state.urgency.lower() == "high" else ""
    print(f"\n[AXIOM] Reward scores  (higher = better){urgency_note}")
    print(f"[AXIOM]   HUB_FLIGHT   friction={hub_score.friction:5.1f}  cost=${hub_score.cost_usd:6.0f}  reward={r_hub:8.2f}")
    print(f"[AXIOM]   LOCAL_CLINIC friction={local_score.friction:5.1f}  cost=${local_score.cost_usd:6.0f}  reward={r_local:8.2f}")
    print(f"[AXIOM]   MOBILE_UNIT  friction={mobile_score.friction:5.1f}  cost=${mobile_score.cost_usd:6.0f}  reward={r_mobile:8.2f}")

    # --- Evaluate & return ---
    response = evaluate_logistics(req)
    print(f"\n[AXIOM] ✓ Decision     {response.selected_action.value}")
    print(f"[AXIOM] Rationale      {response.rationale[:120]}…")
    print("=" * 60 + "\n")

    return response
