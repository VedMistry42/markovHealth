from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from constants import HYBRID_CLINICS, MOBILE_DEPOTS, TRIAL_HUBS
from engine import evaluate_logistics, score_hub_flight, score_local_clinic, score_mobile_unit, _build_state
from models import ActionEnum, PatientRequest, RouteResponse

app = FastAPI(
    title="markovHealth RL Logistics Engine",
    description=(
        "Reward: R(s,a) = α·M − β·d·F − γ·C  [+ urgency_bonus]\n"
        "α=match_weight, β=empathy_weight (fragility×distance), γ=cost_weight"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "engine": "markovHealth RL v2 — Empathy Reward Function"}


@app.post("/calculate-route", response_model=RouteResponse)
def calculate_route(
    req: PatientRequest,
    force_action: Optional[ActionEnum] = Query(
        None,
        description="Demo override: force a specific action regardless of reward scores.",
    ),
) -> RouteResponse:
    """
    Full RL routing evaluation.

    The engine scores all three actions using:
        R(s, a) = α·M_i  −  β·d(P_i, R_j)·F_i  −  γ·C_ops

    Where F_i (fragility_index) drives the Empathy Penalty — a fragile patient
    (high ECOG) facing a long journey incurs a large penalty, forcing the engine
    to dispatch a mobile unit even when that's operationally more expensive.

    Returns a RouteResponse that includes:
    - selected_action + rationale
    - cost_analysis with empathy_penalty
    - geometry (GeoJSON LineString for Mapbox)
    - logistics_plan with EmpathyMetrics (patient_travel_saved_miles, etc.)
    """
    print("\n" + "=" * 60)
    print(f"[markovRL] patient_id={req.patient_id}")
    print(f"[markovRL] coords    lat={req.patient_coords.lat:.4f}  lng={req.patient_coords.lng:.4f}")
    print(f"[markovRL] match_score={req.match_score:.1f}  fragility={req.fragility_index:.2f}  is_match={req.is_match}")

    if not req.is_match:
        raise HTTPException(status_code=400, detail="Patient not eligible for this trial.")

    state = _build_state(req)
    print(f"[markovRL] nearest hub    : {state.nearest_hub['name']}  ({state.dist_to_hub_miles:.1f} mi)")
    print(f"[markovRL] nearest clinic : {state.nearest_clinic['name']}  ({state.dist_to_clinic_miles:.1f} mi)")
    print(f"[markovRL] nearest depot  : {state.nearest_depot['name']}  ({state.dist_to_depot_miles:.1f} mi)")

    hub_s    = score_hub_flight(state)
    clinic_s = score_local_clinic(state)
    mobile_s = score_mobile_unit(state)

    print(f"\n[markovRL] Reward scores (R = α·M − β·d·F − γ·C)")
    print(f"  HUB_FLIGHT   : M={hub_s.match_term:.1f}  penalty={hub_s.empathy_penalty:.1f}  cost={hub_s.cost_term:.1f}  R={hub_s.reward:.2f}")
    print(f"  LOCAL_CLINIC : M={clinic_s.match_term:.1f}  penalty={clinic_s.empathy_penalty:.1f}  cost={clinic_s.cost_term:.1f}  R={clinic_s.reward:.2f}")
    print(f"  MOBILE_UNIT  : M={mobile_s.match_term:.1f}  penalty={mobile_s.empathy_penalty:.1f}  cost={mobile_s.cost_term:.1f}  R={mobile_s.reward:.2f}")

    response = evaluate_logistics(req)

    print(f"\n[markovRL] DECISION: {response.selected_action.value}")
    print(f"[markovRL] travel_saved={response.logistics_plan.empathy_metrics.patient_travel_saved_miles:.1f} mi")
    print(f"[markovRL] fragility_accommodated={response.logistics_plan.empathy_metrics.fragility_accommodated}")
    print(f"[markovRL] empathy_penalty={response.logistics_plan.empathy_metrics.empathy_penalty_applied:.2f}")
    print("=" * 60 + "\n")

    return response
