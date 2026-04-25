"""
utils.py — Geospatial math and routing helpers for Axiom.

All public functions accept coordinates as (lat, lng) tuples and return
GeoJSON-compatible [lng, lat] lists where noted, keeping Mapbox happy.

Coordinate convention
---------------------
  Internal computation  →  (lat, lng)  tuples
  GeoJSON / Mapbox      →  [lng, lat]  lists   ← all *output* of this module
"""

import math
from typing import Any

from geopy.distance import geodesic


# ---------------------------------------------------------------------------
# Distance & travel time
# ---------------------------------------------------------------------------

def calculate_distance(point1: tuple[float, float], point2: tuple[float, float]) -> float:
    """Return the geodesic distance in miles between two (lat, lng) points.

    Uses the WGS-84 ellipsoid via geopy — more accurate than the spherical
    Haversine formula for long distances (e.g. Ithaca → Houston).

    Args:
        point1: (lat, lng) of the origin.
        point2: (lat, lng) of the destination.

    Returns:
        Distance in miles (float).
    """
    return geodesic(point1, point2).miles


def estimate_travel_time(distance_miles: float, mode: str = "car") -> float:
    """Estimate one-way travel time in minutes for a given distance and mode.

    Speed assumptions (conservative averages):
        car    — 45 mph  (accounts for rural roads around Ithaca)
        flight — 400 mph (commercial regional jet cruise speed)

    Args:
        distance_miles: Distance in miles.
        mode: One of 'car' or 'flight'.

    Returns:
        Estimated travel time in minutes (float).

    Raises:
        ValueError: If an unsupported mode is supplied.
    """
    speeds = {"car": 45.0, "flight": 400.0}
    if mode not in speeds:
        raise ValueError(f"Unsupported mode '{mode}'. Choose from: {list(speeds)}")
    return (distance_miles / speeds[mode]) * 60.0


# ---------------------------------------------------------------------------
# Nearest-facility finders
# ---------------------------------------------------------------------------

def find_nearest(
    origin: tuple[float, float],
    locations: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the closest facility dict from a list, measured from origin.

    Each dict in `locations` must have 'lat' and 'lng' keys.

    Args:
        origin: (lat, lng) of the reference point.
        locations: List of facility dicts (from constants.py).

    Returns:
        The facility dict with the smallest geodesic distance to origin.
    """
    return min(
        locations,
        key=lambda loc: calculate_distance(origin, (loc["lat"], loc["lng"])),
    )


def find_nearest_hub(
    origin: tuple[float, float],
    hubs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the nearest trial hub hospital to origin.

    Args:
        origin: (lat, lng) of the patient.
        hubs: TRIAL_HUBS list from constants.py.

    Returns:
        Nearest hub dict.
    """
    return find_nearest(origin, hubs)


def find_nearest_clinic(
    origin: tuple[float, float],
    clinics: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the nearest hybrid clinic to origin with available capacity.

    Falls back to the nearest clinic regardless of capacity if all are full,
    so the routing logic always has a destination to work with.

    Args:
        origin: (lat, lng) of the patient.
        clinics: HYBRID_CLINICS list from constants.py.

    Returns:
        Nearest clinic dict (prefers capacity > 0).
    """
    available = [c for c in clinics if c.get("capacity", 0) > 0]
    pool = available if available else clinics
    return find_nearest(origin, pool)


def find_nearest_depot(
    origin: tuple[float, float],
    depots: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return the nearest mobile-unit depot to origin with available units.

    Falls back to the nearest depot regardless of capacity if all are empty.

    Args:
        origin: (lat, lng) of the patient.
        depots: MOBILE_DEPOTS list from constants.py.

    Returns:
        Nearest depot dict (prefers capacity > 0).
    """
    available = [d for d in depots if d.get("capacity", 0) > 0]
    pool = available if available else depots
    return find_nearest(origin, pool)


# ---------------------------------------------------------------------------
# Curved route geometry (quadratic Bézier)
# ---------------------------------------------------------------------------

def generate_bezier_waypoints(
    start: tuple[float, float],
    end: tuple[float, float],
    num_points: int = 20,
    bump_fraction: float = 0.15,
) -> list[list[float]]:
    """Generate a smooth quadratic Bézier arc between two (lat, lng) points.

    A perpendicular control-point offset of `bump_fraction` × straight-line
    distance creates a professional-looking curved polyline in Mapbox rather
    than a flat straight line.

    The perpendicular bump is applied in the lat/lng plane — good enough for
    the distances involved in this demo (< 2 000 miles).

    Args:
        start: (lat, lng) of the route start.
        end:   (lat, lng) of the route end.
        num_points: Number of interpolated waypoints (including start & end).
        bump_fraction: Fraction of straight-line distance used as the
                       perpendicular control-point offset (0.10–0.20 works well).

    Returns:
        List of [lng, lat] positions in GeoJSON order, ready for Mapbox.
    """
    lat0, lng0 = start
    lat1, lng1 = end

    # Midpoint in lat/lng space
    mid_lat = (lat0 + lat1) / 2.0
    mid_lng = (lng0 + lng1) / 2.0

    # Direction vector
    dlat = lat1 - lat0
    dlng = lng1 - lng0
    length = math.hypot(dlat, dlng)

    # Perpendicular unit vector (rotate 90°)
    if length > 0:
        perp_lat = -dlng / length
        perp_lng = dlat / length
    else:
        perp_lat, perp_lng = 0.0, 0.0

    # Control point offset
    bump = length * bump_fraction
    ctrl_lat = mid_lat + perp_lat * bump
    ctrl_lng = mid_lng + perp_lng * bump

    # Sample the quadratic Bézier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    waypoints: list[list[float]] = []
    for i in range(num_points):
        t = i / (num_points - 1)
        u = 1.0 - t
        lat = u * u * lat0 + 2 * u * t * ctrl_lat + t * t * lat1
        lng = u * u * lng0 + 2 * u * t * ctrl_lng + t * t * lng1
        waypoints.append([lng, lat])  # GeoJSON: [lng, lat]

    return waypoints


# ---------------------------------------------------------------------------
# Action-aware GeoJSON route builder
# ---------------------------------------------------------------------------

# Import deferred to avoid circular dependency (engine → utils → models).
# The ActionEnum string values are compared directly so no import is needed.
_HUB_FLIGHT   = "HUB_FLIGHT"
_LOCAL_CLINIC = "LOCAL_CLINIC"
_MOBILE_UNIT  = "MOBILE_UNIT"


def build_route_geometry(
    action: str,
    patient: tuple[float, float],
    facility: dict[str, Any],
    num_points: int = 20,
) -> list[list[float]]:
    """Build a GeoJSON-compatible [lng, lat] polyline for a given action.

    Direction semantics differ by action type so that the rendered Mapbox
    arrow (if any) points in the logistically correct direction:

    * LOCAL_CLINIC — patient travels TO the clinic.
      Route: patient → clinic.

    * HUB_FLIGHT   — patient travels TO the hub (long arc, larger bump).
      Route: patient → hub.
      The bump_fraction is raised to 0.25 so the arc is visually dramatic
      over the longer inter-city distance.

    * MOBILE_UNIT  — the unit travels FROM the depot TO the patient.
      Route: depot → patient.
      This reverses the direction so an animated dash on the line conveys
      the unit moving toward the patient, not away.

    All coordinates are returned as [lng, lat] for Mapbox compatibility.

    Args:
        action:     ActionEnum value string — 'HUB_FLIGHT', 'LOCAL_CLINIC',
                    or 'MOBILE_UNIT'.
        patient:    (lat, lng) of the patient's current position.
        facility:   Facility dict with 'lat' and 'lng' keys (hub / clinic /
                    depot, depending on action).
        num_points: Number of Bézier sample points (default 20).

    Returns:
        List of [lng, lat] positions forming a smooth curved polyline.

    Raises:
        ValueError: If an unrecognised action string is supplied.
    """
    fac_point = (facility["lat"], facility["lng"])

    if action == _LOCAL_CLINIC:
        # Patient → Clinic (standard forward arc)
        return generate_bezier_waypoints(
            patient, fac_point, num_points=num_points, bump_fraction=0.15
        )

    elif action == _HUB_FLIGHT:
        # Patient → Hub (long-distance arc — larger visual bump)
        return generate_bezier_waypoints(
            patient, fac_point, num_points=num_points, bump_fraction=0.25
        )

    elif action == _MOBILE_UNIT:
        # Depot → Patient (reversed: unit dispatched to patient)
        return generate_bezier_waypoints(
            fac_point, patient, num_points=num_points, bump_fraction=0.15
        )

    else:
        raise ValueError(
            f"Unknown action '{action}'. Expected one of: "
            f"{_HUB_FLIGHT}, {_LOCAL_CLINIC}, {_MOBILE_UNIT}."
        )
