"""
constants.py — markovHealth RL engine constants.

Reward: R(s,a) = α·M  −  β·d·F  −  γ·C  [+ urgency_bonus if high & mobile]

Weights tuned so that a fragile patient (F≥0.5) >20 miles from a clinic
tips the engine from LOCAL_CLINIC → MOBILE_UNIT.
"""

# Reward weights
MATCH_WEIGHT:   float = 1.2    # α — bonus per match-score point
EMPATHY_WEIGHT: float = 0.8    # β — miles × fragility penalty multiplier
COST_WEIGHT:    float = 0.05   # γ — cost penalty per dollar
URGENCY_BONUS:  float = 30.0   # bonus for MOBILE_UNIT when urgency == "high"

# Trial Hub Hospitals (HUB_FLIGHT destinations)
TRIAL_HUBS: list = [
    {"name": "Weill Cornell Medicine",     "lat": 40.7644, "lng": -73.9545, "city": "New York, NY"},
    {"name": "MD Anderson Cancer Center",  "lat": 29.7062, "lng": -95.3976, "city": "Houston, TX"},
]

# Hybrid Clinics (LOCAL_CLINIC destinations)
HYBRID_CLINICS: list = [
    {"name": "Cayuga Medical Center",      "lat": 42.4690, "lng": -76.5265, "city": "Ithaca, NY",    "capacity": 5},
    {"name": "WellNow Urgent Care Ithaca", "lat": 42.4515, "lng": -76.4754, "city": "Ithaca, NY",    "capacity": 5},
    {"name": "Upstate University Hospital","lat": 43.0481, "lng": -76.1474, "city": "Syracuse, NY",  "capacity": 3},
    {"name": "Rochester Regional Health",  "lat": 43.1566, "lng": -77.6088, "city": "Rochester, NY", "capacity": 4},
]

# Mobile Unit Depots (MOBILE_UNIT origin points)
MOBILE_DEPOTS: list = [
    {"name": "Collegetown Depot",     "lat": 42.4433, "lng": -76.4850, "city": "Ithaca, NY",    "capacity": 5},
    {"name": "Downtown Depot",        "lat": 42.4390, "lng": -76.4970, "city": "Ithaca, NY",    "capacity": 5},
    {"name": "Syracuse Staging Area", "lat": 43.0600, "lng": -76.1500, "city": "Syracuse, NY",  "capacity": 3},
    {"name": "Rochester Mobile Hub",  "lat": 43.1500, "lng": -77.6000, "city": "Rochester, NY", "capacity": 2},
    {"name": "Buffalo Mobile Hub",    "lat": 42.8864, "lng": -78.8784, "city": "Buffalo, NY",   "capacity": 2},
    {"name": "Albany Staging Area",   "lat": 42.6526, "lng": -73.7562, "city": "Albany, NY",    "capacity": 2},
]
