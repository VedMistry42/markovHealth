export const TRIAL_ID = "trial-onco-001"
export const TRIAL_NAME = "Phase II: Targeted KRAS G12C Inhibitor in Advanced NSCLC"

export const TRIAL_CRITERIA = `
TRIAL: ${TRIAL_NAME}
TRIAL ID: ${TRIAL_ID}
SPONSOR: markovHealth Research Consortium

INCLUSION CRITERIA:
1. Histologically confirmed non-small cell lung cancer (NSCLC), adenocarcinoma subtype
2. Confirmed KRAS G12C mutation by validated molecular assay (NGS or PCR)
3. Stage IIIB or IV (metastatic) disease at time of enrollment
4. Measurable disease per RECIST v1.1 criteria
5. ECOG performance status 0 or 1
6. Age ≥ 18 years
7. Adequate organ function (ANC ≥ 1.5 × 10⁹/L, platelets ≥ 100 × 10⁹/L, creatinine clearance ≥ 45 mL/min)
8. Prior platinum-based chemotherapy (1–2 prior lines)
9. Recovered from prior treatment toxicities to Grade ≤ 1

EXCLUSION CRITERIA:
1. Active brain metastases (treated and stable brain mets allowed if off steroids ≥ 4 weeks)
2. Prior treatment with a KRAS G12C inhibitor (e.g., sotorasib, adagrasib)
3. Concurrent malignancy requiring active treatment
4. Active autoimmune disease requiring systemic treatment
5. Known hypersensitivity to any component of the investigational agent
6. Pregnancy or breastfeeding
7. Active uncontrolled infection
8. Symptomatic interstitial lung disease
`.trim()

export const HUBS = [
  { id: "hub-1", name: "Memorial Cancer Center", lat: 40.7589, lng: -73.9851, city: "New York, NY" },
  { id: "hub-2", name: "Pacific Oncology Institute", lat: 34.0522, lng: -118.2437, city: "Los Angeles, CA" },
  { id: "hub-3", name: "Midwest Clinical Research Hub", lat: 41.8781, lng: -87.6298, city: "Chicago, IL" },
]

export const MOCK_PATIENTS = [
  { id: "p-001", label: "Patient-01", lat: 40.6892, lng: -74.0445, status: "pending", trialId: TRIAL_ID },
  { id: "p-002", label: "Patient-02", lat: 40.8448, lng: -73.8648, status: "matched", trialId: TRIAL_ID },
  { id: "p-003", label: "Patient-03", lat: 34.1478, lng: -118.1445, status: "pending", trialId: TRIAL_ID },
  { id: "p-004", label: "Patient-04", lat: 33.9425, lng: -118.4081, status: "dispatched", trialId: TRIAL_ID },
  { id: "p-005", label: "Patient-05", lat: 41.9742, lng: -87.9073, status: "matched", trialId: TRIAL_ID },
  { id: "p-006", label: "Patient-06", lat: 41.7508, lng: -87.7430, status: "pending", trialId: TRIAL_ID },
  { id: "p-007", label: "Patient-07", lat: 40.7282, lng: -73.7949, status: "dispatched", trialId: TRIAL_ID },
  { id: "p-008", label: "Patient-08", lat: 34.0195, lng: -118.4912, status: "pending", trialId: TRIAL_ID },
  { id: "p-009", label: "Patient-09", lat: 41.8308, lng: -87.5036, status: "matched", trialId: TRIAL_ID },
  { id: "p-010", label: "Patient-10", lat: 40.6501, lng: -73.9496, status: "pending", trialId: TRIAL_ID },
]

export const MOBILE_UNITS = [
  { id: "mu-1", label: "Unit Alpha", lat: 40.7128, lng: -74.0060, assignedPatient: "p-007" },
  { id: "mu-2", label: "Unit Beta", lat: 33.9800, lng: -118.3500, assignedPatient: "p-004" },
]

export const MOCK_PATIENT_SUMMARY = `
Clinical Summary — Oncology Patient

Chief Complaint: Follow-up for known metastatic lung malignancy.

History of Present Illness:
Patient is an adult with a confirmed diagnosis of non-small cell lung cancer, adenocarcinoma histology, with metastatic disease to the contralateral lung and mediastinal lymph nodes (Stage IV). Molecular profiling performed via next-generation sequencing demonstrates a KRAS G12C mutation. No EGFR, ALK, ROS1, or RET alterations detected. PD-L1 expression 15%.

The patient has received two prior lines of systemic therapy: first-line carboplatin/pemetrexed followed by second-line docetaxel. Best response was stable disease. Current ECOG performance status is 1. No known brain metastases on most recent MRI (3 months ago). Measurable disease present per RECIST v1.1 with index lesion in right lower lobe measuring 2.3 cm.

Organ function within normal limits. No active autoimmune disease. Not pregnant. No prior KRAS inhibitor therapy.

Patient expresses interest in clinical trial participation and is willing to travel for treatment.
`.trim()
