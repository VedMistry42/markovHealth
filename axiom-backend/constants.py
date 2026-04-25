"""
constants.py — markovHealth RL routing engine constants.

Reward weights for: R(s,a) = α·M  −  β·d·F  −  γ·C  [+ urgency_bonus]

α (MATCH_WEIGHT)   — reward for capturing a high-confidence matched patient.
β (EMPATHY_WEIGHT) — scales distance × fragility penalty. Higher = engine
                     more aggressively dispatches mobile units for fragile patients.
γ (COST_WEIGHT)    — penalises operational spend (nurse, fuel, hub logistics).

Weights do NOT need to sum to 1 — they are in reward-space units.
The tuned values below were chosen so that a fragile patient (F=0.75)
20+ miles from a clinic tips the engine from LOCAL_CLINIC → MOBILE_UNIT.
"""

# ---------------------------------------------------------------------------
# Reward weights
# ---------------------------------------------------------------------------

MATCH_WEIGHT:   float = 1.2    # α — bonus per match-score point
EMPATHY_WEIGHT: float = 0.8    # β — miles × fragility penalty multiplier
COST_WEIGHT:    float = 0.05   # γ — cost penalty per dollar
URGENCY_BONUS:  float = 30.0   # added to MOBILE_UNIT reward when urgency == high

# ---------------------------------------------------------------------------
# Trial Hub Hospitals (HUB_FLIGHT destinations)
# ---------------------------------------------------------------------------

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
# Hybrid Clinics (LOCAL_CLINIC destinations)
# ---------------------------------------------------------------------------

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
    {
        "name": "Upstate University Hospital",
        "lat": 43.0481,
        "lng": -76.1474,
        "city": "Syracuse, NY",
        "capacity": 3,
    },
    {
        "name": "Rochester Regional Health",
        "lat": 43.1566,
        "lng": -77.6088,
        "city": "Rochester, NY",
        "capacity": 4,
    },
]

# ---------------------------------------------------------------------------
# Mobile Unit Depots (MOBILE_UNIT origin points)
# ---------------------------------------------------------------------------

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
    {
        "name": "Syracuse Staging Area",
        "lat": 43.0600,
        "lng": -76.1500,
        "city": "Syracuse, NY",
        "capacity": 3,
    },
    {
        "name": "Rochester Mobile Hub",
        "lat": 43.1500,
        "lng": -77.6000,
        "city": "Rochester, NY",
        "capacity": 2,
    },
]
