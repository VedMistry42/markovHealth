"""
main.py — markovHealth RL Logistics Engine API

Reward: R(s,a) = α·M − β·d·F − γ·C  [+ urgency_bonus]
"""
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from constants import HYBRID_CLINICS, MOBILE_DEPOTS, TRIAL_HUBS
from engine import evaluate_logistics, score_hub_flight, score_local_clinic, score_mobile_unit, _build_state
from models import ActionEnum, PatientRequest, RouteResponse

app = FastAPI(
    title="markovHealth RL Logistics Engine",
    description="R(s,a) = α·M − β·d·F − γ·C. Empathy Penalty drives mobile unit dispatch for fragile patients.",
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
    return {
        "status": "ok",
        "engine": "markovHealth RL v2 — Empathy Reward Function",
        "reward_function": "R(s,a) = α·M − β·d·F − γ·C"
    }


@app.post("/calculate-route", response_model=RouteResponse)
def calculate_route(req: PatientRequest) -> RouteResponse:
    """
    RL routing evaluation.

    The engine scores all three actions:
        R(s, a) = α·M_i  −  β·d(P_i, R_j)·F_i  −  γ·C_ops

    Where F_i (fragility_index) is the Empathy Penalty driver — a fragile
    patient facing a long journey incurs a large β·d·F penalty, forcing
    dispatch of a mobile unit even when operationally more expensive.

    Returns:
    - selected_action + rationale
    - cost_analysis with empathy_penalty
    - geometry (GeoJSON LineString for Mapbox)
    - logistics_plan with EmpathyMetrics
    """
    if not req.is_match:
        raise HTTPException(status_code=400, detail="Patient not eligible for this trial.")

    state = _build_state(req)

    hub_s    = score_hub_flight(state)
    clinic_s = score_local_clinic(state)
    mobile_s = score_mobile_unit(state)

    print(f"\n[markovRL] patient={req.patient_id}  match={req.match_score:.0f}  fragility={req.fragility_index:.2f}")
    print(f"  HUB_FLIGHT   R={hub_s.reward:.2f}  (α·M={hub_s.match_term:.1f}  β·d·F={hub_s.empathy_penalty:.1f}  γ·C={hub_s.cost_term:.1f})")
    print(f"  LOCAL_CLINIC R={clinic_s.reward:.2f}  (β·d·F={clinic_s.empathy_penalty:.1f})")
    print(f"  MOBILE_UNIT  R={mobile_s.reward:.2f}  (β·d·F=0.0  — patient travels 0 miles)")

    response = evaluate_logistics(req)
    em = response.logistics_plan.empathy_metrics
    print(f"  → DECISION: {response.selected_action.value}  travel_saved={em.patient_travel_saved_miles:.1f}mi  fragility_accommodated={em.fragility_accommodated}")

    return response
