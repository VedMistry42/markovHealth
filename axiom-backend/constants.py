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
# STG-RL Bellman reward formula:
#
#   R(s,a) = α·M_i  -  β·d(P_i,R_j)·F_i  -  γ·C_ops
#
#   α·M_i            → MATCH_WEIGHT   × match_score  (reward capturing high-confidence patients)
#   β·d·F_i          → FRICTION_WEIGHT × friction × (1 + fragility_index)  (Empathy Penalty)
#   γ·C_ops          → COST_WEIGHT    × cost_score   (operational cost)
#   UrgencyBonus     → URGENCY_WEIGHT bonus when urgency == 'high'
#
# Outer weights (α + β + γ + urgency) are unconstrained — match score adds
# a positive term so the sum no longer needs to equal 1.0.

MATCH_WEIGHT:    float = 0.05  # α — scales M_i (0-100) into reward space
FRICTION_WEIGHT: float = 0.4   # β — penalises patient travel × fragility
COST_WEIGHT:     float = 0.2   # γ — penalises operational cost (0-100 scale)
URGENCY_WEIGHT:  float = 0.4   # bonus when urgency is high

# ---------------------------------------------------------------------------
# Test Kit costs (TEST_KIT action)
# ---------------------------------------------------------------------------
# Cheapest option — patient pays only for shipping; no nurse or clinic overhead.

TEST_KIT_COST: float = 50    # USD — FedEx/UPS shipping only
TEST_KIT_FRICTION: float = 5  # Minimal — patient opens a box at home
