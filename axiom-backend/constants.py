"""
constants.py — Mock world-state for Axiom routing demo.

All coordinates are real-world locations chosen to produce clean Mapbox
polylines centred on Ithaca, NY.  Capacity values simulate live slot
availability that a real system would pull from an EHR or scheduling API.
"""

# ---------------------------------------------------------------------------
# Trial Hub Hospitals (air-transport destinations)
# ---------------------------------------------------------------------------
# High-capability facilities reachable by HUB_FLIGHT action.
# Each hub has no capacity cap — they are always assumed to have capacity.

TRIAL_HUBS: list[dict] = [
    {
        "name": "Weill Cornell Medicine",
        "lat": 40.7644,
        "lng": -73.9545,
        "city": "New York, NY",
    },
    {
        "name": "MD Anderson Cancer Center",
        "lat": 29.7062,
        "lng": -95.3976,
        "city": "Houston, TX",
    },
]

# ---------------------------------------------------------------------------
# Hybrid Clinics (LOCAL_CLINIC action destinations)
# ---------------------------------------------------------------------------
# Brick-and-mortar clinics in the Ithaca / Finger Lakes region.
# `capacity` is the number of same-day walk-in slots available (mock value).

HYBRID_CLINICS: list[dict] = [
    {
        "name": "Cayuga Medical Center",
        "lat": 42.4690,
        "lng": -76.5265,
        "city": "Ithaca, NY",
        "capacity": 5,
    },
    {
        "name": "WellNow Urgent Care Ithaca",
        "lat": 42.4515,
        "lng": -76.4754,
        "city": "Ithaca, NY",
        "capacity": 5,
    },
]

# ---------------------------------------------------------------------------
# Mobile Unit Depots (MOBILE_UNIT action origin points)
# ---------------------------------------------------------------------------
# Staging locations where mobile health units are parked and ready to deploy.
# `capacity` is the number of units available at each depot (mock value).

MOBILE_DEPOTS: list[dict] = [
    {
        "name": "Collegetown Depot",
        "lat": 42.4433,
        "lng": -76.4850,
        "city": "Ithaca, NY",
        "capacity": 5,
    },
    {
        "name": "Downtown Depot",
        "lat": 42.4390,
        "lng": -76.4970,
        "city": "Ithaca, NY",
        "capacity": 5,
    },
]

# ---------------------------------------------------------------------------
# Reward-function weights
# ---------------------------------------------------------------------------
# Three-term multi-objective reward:
#   R = -(FRICTION_WEIGHT * PatientFriction)
#       - (COST_WEIGHT    * OperationalCost)
#       + (URGENCY_WEIGHT * UrgencyBonus)
#
# Weights must sum to 1.0.

FRICTION_WEIGHT: float = 0.4   # Penalises patient travel burden
COST_WEIGHT:     float = 0.2   # Penalises system operational cost (0–100 scale)
URGENCY_WEIGHT:  float = 0.4   # Rewards zero-friction options when urgency is high

assert abs(FRICTION_WEIGHT + COST_WEIGHT + URGENCY_WEIGHT - 1.0) < 1e-9, (
    "FRICTION_WEIGHT + COST_WEIGHT + URGENCY_WEIGHT must equal 1.0"
)
