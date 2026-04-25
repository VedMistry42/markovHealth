import hashlib
import hmac as hmac_lib
import json
import os
import time
from typing import Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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
    calc_test_kit_score,
    evaluate_logistics,
)
from models import ActionEnum, CostAnalysis, EmpathyMetrics, Geometry, Location, MatchData, PatientRequest, RouteResponse
from utils import build_route_geometry

# ---------------------------------------------------------------------------
# In-memory route store (survives the process lifetime)
# ---------------------------------------------------------------------------
_route_store: Dict[str, dict] = {}   # patientId → serialised RouteResponse

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
    """Evaluate all four care-delivery actions and return the best route.

    Pass `?force_action=MOBILE_UNIT` (or HUB_FLIGHT / LOCAL_CLINIC / TEST_KIT) to bypass
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

    # --- Score all four actions (always computed for the reward log) ---
    hub_score     = calc_hub_score(state)
    local_score   = calc_local_score(state)
    mobile_score  = calc_mobile_score(state)
    kit_score     = calc_test_kit_score(state)

    r_hub    = _reward(hub_score,    state.urgency, state.fragility_index, state.match_score)
    r_local  = _reward(local_score,  state.urgency, state.fragility_index, state.match_score)
    r_mobile = _reward(mobile_score, state.urgency, state.fragility_index, state.match_score)
    r_kit    = _reward(kit_score,    state.urgency, state.fragility_index, state.match_score)

    urgency_note = "  ← UrgencyBonus active (HIGH urgency)" if state.urgency.lower() == "high" else ""
    print(f"\n[AXIOM] Reward scores  (higher = better){urgency_note}")
    print(f"[AXIOM]   HUB_FLIGHT   friction={hub_score.friction:6.2f}  cost_score={hub_score.cost_score:5.0f}  urgency_bonus={hub_score.urgency_bonus:5.0f}  reward={r_hub:8.2f}")
    print(f"[AXIOM]   LOCAL_CLINIC friction={local_score.friction:6.2f}  cost_score={local_score.cost_score:5.0f}  urgency_bonus={local_score.urgency_bonus:5.0f}  reward={r_local:8.2f}")
    print(f"[AXIOM]   MOBILE_UNIT  friction={mobile_score.friction:6.2f}  cost_score={mobile_score.cost_score:5.0f}  urgency_bonus={mobile_score.urgency_bonus:5.0f}  reward={r_mobile:8.2f}")
    print(f"[AXIOM]   TEST_KIT     friction={kit_score.friction:6.2f}  cost_score={kit_score.cost_score:5.0f}  urgency_bonus={kit_score.urgency_bonus:5.0f}  reward={r_kit:8.2f}")

    # --- Demo override: bypass engine and force a specific action ---
    if force_action is not None:
        print(f"\n[AXIOM] ⚡ DEMO OVERRIDE — forcing action: {force_action.value}")
        score_map = {
            ActionEnum.HUB_FLIGHT:   hub_score,
            ActionEnum.LOCAL_CLINIC: local_score,
            ActionEnum.MOBILE_UNIT:  mobile_score,
            ActionEnum.TEST_KIT:     kit_score,
        }
        reward_map = {
            ActionEnum.HUB_FLIGHT:   r_hub,
            ActionEnum.LOCAL_CLINIC: r_local,
            ActionEnum.MOBILE_UNIT:  r_mobile,
            ActionEnum.TEST_KIT:     r_kit,
        }
        forced_score  = score_map[force_action]
        forced_reward = reward_map[force_action]
        facility_map = {
            ActionEnum.HUB_FLIGHT:   state.nearest_hub,
            ActionEnum.LOCAL_CLINIC: state.nearest_clinic,
            ActionEnum.MOBILE_UNIT:  state.nearest_depot,
            ActionEnum.TEST_KIT:     state.nearest_hub,
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
        from engine import _dropout_risk
        travel_saved_map = {
            ActionEnum.HUB_FLIGHT:   0.0,
            ActionEnum.LOCAL_CLINIC: max(0.0, state.dist_to_hub_miles - state.dist_to_clinic_miles),
            ActionEnum.MOBILE_UNIT:  state.dist_to_hub_miles,
            ActionEnum.TEST_KIT:     state.dist_to_hub_miles,
        }
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
            empathy_metrics=EmpathyMetrics(
                patient_travel_saved_miles=round(travel_saved_map[force_action], 1),
                fragility_accommodated=force_action in (ActionEnum.MOBILE_UNIT, ActionEnum.TEST_KIT),
                match_score=state.match_score,
                dropout_risk_pct=_dropout_risk(force_action, state.dist_to_clinic_miles),
            ),
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


# ---------------------------------------------------------------------------
# Webhook — receives HMAC-signed dispatch from the Next.js match pipeline
# ---------------------------------------------------------------------------

class WebhookPayload(BaseModel):
    patientId: str
    lat: float
    lng: float
    trialId: str
    confidenceScore: float = Field(ge=0, le=100)
    # Extended fields populated when Gemini extracts clinical context
    urgency: str = "low"
    condition: str = "Advanced NSCLC, KRAS G12C"
    fragility_index: float = Field(0.5, ge=0, le=1)


def _verify_hmac(body_bytes: bytes, signature_header: str, secret: str) -> bool:
    """Return True if the HMAC-SHA256 signature matches."""
    expected = "sha256=" + hmac_lib.new(
        secret.encode(), body_bytes, hashlib.sha256
    ).hexdigest()
    return hmac_lib.compare_digest(signature_header, expected)


@app.post("/webhook", status_code=200)
async def webhook(request: Request) -> dict:
    """HMAC-authenticated webhook called by the Next.js match pipeline.

    When a patient is confirmed as a trial match, this endpoint:
      1. Verifies the HMAC-SHA256 signature (if a secret is configured).
      2. Calls the RL routing engine.
      3. Stores the RouteResponse in memory for the clinician map to poll.
    """
    raw_body = await request.body()

    # --- Optional replay-attack check ---
    timestamp_header = request.headers.get("X-Axiom-Timestamp")
    if timestamp_header:
        try:
            age_ms = abs(time.time() * 1000 - int(timestamp_header))
            if age_ms > 300_000:   # reject if >5 min old
                raise HTTPException(status_code=401, detail="Request timestamp too old")
        except ValueError:
            pass

    # --- Optional HMAC verification ---
    secret = os.environ.get("FASTAPI_WEBHOOK_SECRET", "")
    sig_header = request.headers.get("X-Axiom-Signature", "")
    if secret and sig_header:
        # Payload was stringified by JSON.stringify in TypeScript; re-parse
        # from raw bytes so key order is preserved.
        if not _verify_hmac(raw_body, sig_header, secret):
            print("[WEBHOOK] ✗ Invalid signature")
            raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    try:
        payload = WebhookPayload(**json.loads(raw_body))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Bad payload: {exc}") from exc

    print(f"\n[WEBHOOK] Received  patientId={payload.patientId[:12]}…  "
          f"urgency={payload.urgency}  fragility={payload.fragility_index:.2f}  "
          f"match={payload.confidenceScore:.0f}%")

    # Build a PatientRequest and route it through the RL engine
    req = PatientRequest(
        patient_id=payload.patientId,
        patient_coords=Location(lat=payload.lat, lng=payload.lng),
        is_match=True,
        match_data=MatchData(
            condition=payload.condition,
            urgency=payload.urgency,
            fragility_index=payload.fragility_index,
            match_score=payload.confidenceScore,
        ),
    )
    route = evaluate_logistics(req)

    # Persist in the in-memory store (keyed by hashed patientId)
    _route_store[payload.patientId] = {
        "patientId": payload.patientId,
        "trialId": payload.trialId,
        "lat": payload.lat,
        "lng": payload.lng,
        "route": route.model_dump(),
        "receivedAt": time.time(),
    }

    print(f"[WEBHOOK] ✓ Routed   {route.selected_action.value}  "
          f"saved_miles={route.empathy_metrics.patient_travel_saved_miles}")

    return {"status": "ok", "decision": route.selected_action.value}


# ---------------------------------------------------------------------------
# Route-results — clinician map polls this to show live RL decisions
# ---------------------------------------------------------------------------

@app.get("/route-results")
def route_results() -> List[dict]:
    """Return all stored routing decisions for the clinician map.

    Each entry contains the patient location, trial ID, the full RouteResponse
    (including GeoJSON geometry and empathy metrics), and a receivedAt timestamp.
    """
    return list(_route_store.values())
