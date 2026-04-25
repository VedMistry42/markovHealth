import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_high_urgency():
    response = client.post("/calculate-route", json={
        "patient_id": "p-001",
        "patient_coords": {"lat": 42.20, "lng": -76.50},
        "is_match": True,
        "match_data": {"condition": "chest pain", "urgency": "high"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["selected_action"] == "MOBILE_UNIT"
    # Verify geometry is properly formatted for Mapbox
    assert data["geometry"]["type"] == "LineString"
    assert len(data["geometry"]["coordinates"]) == 20
    # Mapbox needs [lng, lat]
    assert data["geometry"]["coordinates"][0] == [-76.497, 42.439] # Downtown Depot start

def test_low_urgency():
    # Non-urgent patient with a simple condition: TEST_KIT wins (reward -4 vs
    # LOCAL_CLINIC -10) because its cost_score (10) and friction (5) are lowest.
    response = client.post("/calculate-route", json={
        "patient_id": "p-002",
        "patient_coords": {"lat": 42.45, "lng": -76.48}, # very close to urgent care
        "is_match": True,
        "match_data": {"condition": "mild rash", "urgency": "low"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["selected_action"] == "TEST_KIT"
    # Verify geometry
    assert len(data["geometry"]["coordinates"]) == 20
    # TEST_KIT route starts from the nearest hub (Weill Cornell) — kit mailed to patient
    assert data["geometry"]["coordinates"][0] == [-73.9545, 40.7644]
    # Rationale must include tracking info
    assert "AX-42881" in data["rationale"]
    assert "Patient Portal" in data["rationale"]

def test_force_action_test_kit():
    # force_action=TEST_KIT must not crash and must return TEST_KIT geometry
    response = client.post("/calculate-route?force_action=TEST_KIT", json={
        "patient_id": "p-004",
        "patient_coords": {"lat": 42.44, "lng": -76.50},
        "is_match": True,
        "match_data": {"condition": "blood panel", "urgency": "high"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["selected_action"] == "TEST_KIT"
    assert len(data["geometry"]["coordinates"]) == 20


def test_no_match():
    response = client.post("/calculate-route", json={
        "patient_id": "p-003",
        "patient_coords": {"lat": 42.20, "lng": -76.50},
        "is_match": False,
        "match_data": {"condition": "healthy", "urgency": "low"}
    })
    assert response.status_code == 400
    assert response.json()["detail"] == "Patient not eligible for this trial."
