// Rich sample patient profiles for demo and testing.
// Entirely fictional — not based on real individuals.

export const PATIENT_ARCHETYPES = [
  {
    id: "arch-1",
    name: "Sarah Jenkins",
    age: 52,
    location: "Ithaca, NY",
    lat: 42.444,
    lng: -76.5019,
    story: "I was diagnosed 8 months ago. I'm a high school art teacher — I want to keep painting and keep teaching. I'm willing to do whatever it takes, but I can't leave my kids for weeks at a time.",
    clinicalText: `ONCOLOGY CONSULTATION NOTE

Chief Complaint: Stage IIIB non-small cell lung cancer, adenocarcinoma.
Genomic profiling: KRAS G12C mutation confirmed. EGFR/ALK/ROS1 negative. PD-L1 TPS 22%.

Prior treatment:
- Line 1: Carboplatin + Pemetrexed x4 cycles (stable disease)
- Line 2: Docetaxel x2 cycles (progressive disease per RECIST 1.1)

Current status:
- ECOG performance status: 1
- No brain metastases (MRI brain, 6 weeks prior)
- Measurable disease: right lower lobe mass 2.8 cm
- ANC 2.1 x10^9/L, Platelets 142 x10^9/L, CrCl 68 mL/min
- No active autoimmune disease. No prior KRAS inhibitor.
- Post-menopausal. Interested in clinical trial participation.`,
  },
  {
    id: "arch-2",
    name: "Marcus Vance",
    age: 61,
    location: "Syracuse, NY",
    lat: 43.0481,
    lng: -76.1474,
    story: "I retired last year to be with my grandkids. Then this happened. I'm fighting this for them — every single day.",
    clinicalText: `ONCOLOGY FOLLOW-UP

Diagnosis: Stage IV NSCLC, adenocarcinoma. KRAS G12C confirmed.
Prior therapy: Carboplatin/Pemetrexed x4 cycles, Pembrolizumab maintenance x8 cycles.
No prior KRAS inhibitor.

Brain MRI: Two treated lesions in right cerebellum (SRS, 5 weeks ago). Stable. Off steroids x4 weeks.
ECOG PS: 1. Measurable disease: 3.1 cm left upper lobe mass. Adequate organ function.`,
  },
  {
    id: "arch-3",
    name: "Elena Rodriguez",
    age: 44,
    location: "Binghamton, NY",
    lat: 42.0987,
    lng: -75.9180,
    story: "Two young kids. I need more time. My oncologist said I've exhausted standard options — please help me find anything that might work.",
    clinicalText: `TUMOR BOARD NOTE

Stage IV NSCLC. EGFR exon 19 deletion. KRAS wild-type.
Received osimertinib first-line; progressed (T790M resistance confirmed at progression).
ECOG 0. No brain metastases. Adequate organ function.
Seeking second-line options. KRAS G12C mutation absent.`,
  },
  {
    id: "arch-4",
    name: "James Okafor",
    age: 58,
    location: "Rochester, NY",
    lat: 43.1566,
    lng: -77.6088,
    story: "I'm a pastor. My congregation has been praying for me. I want to fight this so I can keep serving my community — I'm not ready to step down.",
    clinicalText: `PULMONOLOGY / ONCOLOGY NOTE

Stage IIIA NSCLC, squamous cell carcinoma. KRAS G12C positive (ctDNA liquid biopsy).
Prior: Concurrent chemoradiation (carboplatin/paclitaxel + 60 Gy). Durvalumab maintenance x4 months, discontinued due to immune pneumonitis Grade 2.
ECOG 1. No brain mets. Pulmonary function adequate (FEV1 68% predicted).
No prior KRAS inhibitor. Considered for Phase 2 enrollment.`,
  },
  {
    id: "arch-5",
    name: "Diane Kowalski",
    age: 67,
    location: "Buffalo, NY",
    lat: 42.8864,
    lng: -78.8784,
    story: "My husband drove me to every chemo session. He passed away six months ago. I'm doing this alone now — but I'm still doing it.",
    clinicalText: `ONCOLOGY CONSULT

Diagnosis: Stage IV NSCLC, adenocarcinoma. KRAS G12C mutation (tissue NGS).
Prior: Pembrolizumab + carboplatin/pemetrexed x4 cycles (partial response), maintenance pemetrexed x6 cycles. Progressed on maintenance.
ECOG 1. Brain MRI clear. CrCl 62 mL/min. Platelets 138 x10^9/L.
No prior targeted therapy. No active autoimmune disease.`,
  },
  {
    id: "arch-6",
    name: "Thomas Nguyen",
    age: 49,
    location: "Albany, NY",
    lat: 42.6526,
    lng: -73.7562,
    story: "I'm a software engineer. I've been researching every trial I can find. I'm not passive about this — I want data, I want options, I want to understand every decision.",
    clinicalText: `MEDICAL ONCOLOGY NOTE

Stage IIIB NSCLC, adenocarcinoma. KRAS G12C by tissue NGS (VAF 38%).
PD-L1 TPS 5%. ECOG 0. Former smoker (15 pack-years).
Prior: Carboplatin + pemetrexed + pembrolizumab x4 cycles. Stable disease best response.
Progressive disease on cycle 6 restaging CT. No prior KRAS inhibitor.
No brain mets. Organ function within normal limits. Highly motivated for trial participation.`,
  },
]

// Concrete form inputs for manual testing
export const TEST_PATIENT_DATA = {
  strongMatch: {
    label: "Sarah Jenkins — STRONG MATCH (expect 80-95% confidence, isMatch: true)",
    form: {
      name: "Sarah Jenkins",
      age: "52",
      zip: "14850",
      address: "312 Elm Street, Ithaca, NY 14850",
      story: "I was diagnosed 8 months ago. I'm a high school art teacher — I want to keep painting and keep teaching. I'm willing to do whatever it takes.",
    },
    uploadText: PATIENT_ARCHETYPES[0].clinicalText,
  },
  partialMatch: {
    label: "Marcus Vance — BORDERLINE (treated stable brain mets — trial allows if off steroids >4 wks)",
    form: {
      name: "Marcus Vance",
      age: "61",
      zip: "13201",
      address: "88 Harbor View Drive, Syracuse, NY 13201",
      story: "I retired last year to be with my grandkids. Then this happened. I'm fighting this for them.",
    },
    uploadText: PATIENT_ARCHETYPES[1].clinicalText,
  },
  noMatch: {
    label: "Elena Rodriguez — NO MATCH (EGFR+/KRAS-wt, does not meet KRAS G12C inclusion)",
    form: {
      name: "Elena Rodriguez",
      age: "44",
      zip: "13901",
      address: "555 Riverside Ave, Binghamton, NY 13901",
      story: "Two young kids. I need more time. Please help me find anything that might work.",
    },
    uploadText: PATIENT_ARCHETYPES[2].clinicalText,
  },
}

export const TEST_CLINICIAN_DATA = {
  form: {
    name: "Memorial Sloan Kettering Cancer Center",
    location: "New York, NY 10065",
    specialty: "Thoracic Oncology",
    npi: "1234567890",
  },
}
