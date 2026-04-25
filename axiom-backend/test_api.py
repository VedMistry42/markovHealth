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

def test_low_urgency():
    response = client.post("/calculate-route", json={
        "patient_id": "p-002",
        "patient_coords": {"lat": 42.45, "lng": -76.48}, # very close to urgent care
        "is_match": True,
        "match_data": {"condition": "mild rash", "urgency": "low"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["selected_action"] == "LOCAL_CLINIC"

def test_no_match():
    response = client.post("/calculate-route", json={
        "patient_id": "p-003",
        "patient_coords": {"lat": 42.20, "lng": -76.50},
        "is_match": False,
        "match_data": {"condition": "healthy", "urgency": "low"}
    })
    assert response.status_code == 400
    assert response.json()["detail"] == "Patient not eligible for this trial."
