import { createHash, randomUUID } from "node:crypto"

export interface User {
  id: string; email: string; passwordHash: string
  role: "patient" | "researcher"; name: string; phone: string
  story: string; orgName: string; specialty: string
  lat: number; lng: number; zip: string; createdAt: string
}
export interface MedicalRecord {
  fileHash: string; patientId: string; deidentifiedSummary: string; createdAt: string
}
export interface Trial {
  id: string; researcherId: string; researcherName: string; researcherOrg: string
  researcherEmail: string; researcherPhone: string; name: string; criteria: string
  indication: string; phase: string; createdAt: string
}
export interface PatientTrialStatus {
  id: string; patientId: string; trialId: string
  status: "pending" | "contacted" | "accepted" | "declined"
  lat: number; lng: number; confidenceScore: number; matchedCriteria: string[]; createdAt: string
}
export interface Message {
  id: string; patientId: string; trialId: string; trialName: string
  confidenceScore: number; fromOrg: string; fromName: string
  contactEmail: string; contactPhone: string
  subject: string; body: string; nextSteps: string[]; read: boolean; createdAt: string
}
export interface LogisticsRecord {
  patientId: string; trialId: string; patientName: string
  lat: number; lng: number; route: object; receivedAt: number
}

const g = globalThis as unknown as {
  _axiomUsers: Map<string, User>; _axiomMedical: Map<string, MedicalRecord>
  _axiomTrials: Map<string, Trial>; _axiomStatus: Map<string, PatientTrialStatus>
  _axiomMessages: Map<string, Message>; _axiomLogistics: Map<string, LogisticsRecord>
  _axiomSeeded: boolean
}
g._axiomUsers    ??= new Map()
g._axiomMedical  ??= new Map()
g._axiomTrials   ??= new Map()
g._axiomStatus   ??= new Map()
g._axiomMessages ??= new Map()
g._axiomLogistics ??= new Map()

export function hashPassword(pw: string) {
  return createHash("sha256").update(`${pw}:markov-salt-2024`).digest("hex")
}

export function zipToCoords(zip: string): { lat: number; lng: number } {
  const p = zip.slice(0, 3)
  const t: Record<string, [number, number]> = {
    "148": [42.44, -76.50], "132": [43.05, -76.15], "139": [42.10, -75.91],
    "100": [40.71, -74.01], "101": [40.75, -73.99], "102": [40.73, -73.99],
    "110": [40.73, -73.94], "022": [42.36, -71.06], "606": [41.88, -87.63],
    "900": [34.05, -118.24],"770": [29.76, -95.37], "302": [33.75, -84.39],
    "331": [25.77, -80.19], "941": [37.78, -122.42],"980": [47.61, -122.33],
    "850": [33.45, -112.07],"190": [39.95, -75.17], "200": [38.91, -77.04],
  }
  const c = t[p]
  return c
    ? { lat: c[0] + (Math.random() - 0.5) * 0.15, lng: c[1] + (Math.random() - 0.5) * 0.15 }
    : { lat: 38 + (Math.random() - 0.5) * 10, lng: -97 + (Math.random() - 0.5) * 20 }
}

// ── Demo patient seeding ──────────────────────────────────────────────────────
// Three pre-loaded patients (not meant to log in). Seeded once per server process.
const DEMO_PATIENTS: Array<Omit<User, "createdAt"> & { records: string }> = [
  {
    id: "demo-alice",
    email: "alice.m@markovhealth.demo",
    passwordHash: hashPassword("demo"),
    role: "patient",
    name: "Alice Martinez",
    phone: "(607) 555-0101",
    story: "I'm 58 and I've been fighting Stage IV lung cancer for two years. I have grandkids I want to be around for. I've tried three different chemo regimens — my oncologist thinks targeted therapy might be my next best shot.",
    orgName: "", specialty: "", zip: "14850",
    lat: 42.44, lng: -76.50,
    records: "Patient is a 58-year-old female with histologically confirmed Stage IV Non-Small Cell Lung Cancer (Adenocarcinoma). NGS confirms KRAS G12C mutation (allele frequency 38%). ECOG performance status 1. Prior platinum-based chemotherapy (carboplatin/pemetrexed x4 cycles) completed 6 months ago. Measurable disease per RECIST 1.1 present in right lower lobe and mediastinal lymph nodes. No history of brain metastases. No prior KRAS-directed therapy. Stable renal and hepatic function.",
  },
  {
    id: "demo-carlos",
    email: "carlos.r@markovhealth.demo",
    passwordHash: hashPassword("demo"),
    role: "patient",
    name: "Carlos Rivera",
    phone: "(312) 555-0202",
    story: "Retired teacher, 62. Was diagnosed with NSCLC Stage IIIB after a routine scan. My daughter pushed me to explore every option available. I'm in good shape otherwise — ECOG 1, no brain mets. Ready to fight.",
    orgName: "", specialty: "", zip: "60601",
    lat: 41.88, lng: -87.63,
    records: "Patient is a 62-year-old male with Stage IIIB Non-Small Cell Lung Cancer confirmed by biopsy. NGS testing reveals KRAS G12C mutation. ECOG performance status 1. No active brain metastases on recent MRI. Prior first-line chemotherapy with cisplatin/docetaxel. Measurable disease present. Adequate bone marrow reserve. No contraindications to investigational agents.",
  },
  {
    id: "demo-maria",
    email: "maria.j@markovhealth.demo",
    passwordHash: hashPassword("demo"),
    role: "patient",
    name: "Maria Johnson",
    phone: "(404) 555-0303",
    story: "I'm 45, a mom of three, and I was diagnosed with Stage II breast cancer last spring. I've been through surgery and radiation. Looking for options for maintenance therapy or trials that might help long-term.",
    orgName: "", specialty: "", zip: "30301",
    lat: 33.75, lng: -84.39,
    records: "Patient is a 45-year-old female with Stage II invasive ductal carcinoma of the left breast, ER+/PR+/HER2-. Status post lumpectomy and adjuvant radiation completed 4 months ago. Currently on anastrozole. No evidence of distant metastases. ECOG 0. Looking for maintenance or adjuvant trials. No history of lung disease.",
  },
]


if (!g._axiomSeeded) {
  g._axiomSeeded = true
  for (const { records, ...patient } of DEMO_PATIENTS) {
    if (!g._axiomUsers.has(patient.id)) {
      g._axiomUsers.set(patient.id, { ...patient, createdAt: "2024-01-01T00:00:00.000Z" })
    }
    const hash = createHash("sha256").update(records).digest("hex")
    if (!g._axiomMedical.has(hash)) {
      g._axiomMedical.set(hash, {
        fileHash: hash,
        patientId: patient.id,
        deidentifiedSummary: records,
        createdAt: "2024-01-01T00:00:00.000Z",
      })
    }
  }
}

export const db = {
  user: {
    findByEmail: (email: string): User | null =>
      Array.from(g._axiomUsers.values()).find(u => u.email.toLowerCase() === email.toLowerCase()) ?? null,
    findById: (id: string): User | null => g._axiomUsers.get(id) ?? null,
    create: (data: Omit<User, "id" | "createdAt">): User => {
      const user: User = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
      g._axiomUsers.set(user.id, user); return user
    },
    findPatients: (): User[] => Array.from(g._axiomUsers.values()).filter(u => u.role === "patient"),
  },

  medicalRecord: {
    upsert: async ({ where, update, create }: {
      where: { fileHash: string }; update: Partial<MedicalRecord>; create: Omit<MedicalRecord, "createdAt">
    }): Promise<MedicalRecord> => {
      const ex = Array.from(g._axiomMedical.values()).find(r => r.fileHash === where.fileHash)
      if (ex) { Object.assign(ex, update); return ex }
      const r: MedicalRecord = { ...create, createdAt: new Date().toISOString() }
      g._axiomMedical.set(create.fileHash, r); return r
    },
    findByPatient: (patientId: string): MedicalRecord[] =>
      Array.from(g._axiomMedical.values()).filter(r => r.patientId === patientId),
    findAll: (): MedicalRecord[] => Array.from(g._axiomMedical.values()),
  },

  trial: {
    create: (data: Omit<Trial, "id" | "createdAt">): Trial => {
      const t: Trial = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
      g._axiomTrials.set(t.id, t); return t
    },
    findAll: (): Trial[] =>
      Array.from(g._axiomTrials.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    findById: (id: string): Trial | null => g._axiomTrials.get(id) ?? null,
  },

  patientStatus: {
    upsert: (data: Omit<PatientTrialStatus, "id" | "createdAt">): PatientTrialStatus => {
      const ex = Array.from(g._axiomStatus.values()).find(
        r => r.patientId === data.patientId && r.trialId === data.trialId)
      if (ex) { Object.assign(ex, data); return ex }
      const r: PatientTrialStatus = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
      g._axiomStatus.set(r.id, r); return r
    },
    findAll: (): PatientTrialStatus[] => Array.from(g._axiomStatus.values()),
    findByTrial: (trialId: string): PatientTrialStatus[] =>
      Array.from(g._axiomStatus.values()).filter(r => r.trialId === trialId),
    setStatus: (patientId: string, trialId: string, status: PatientTrialStatus["status"]) => {
      const r = Array.from(g._axiomStatus.values()).find(r => r.patientId === patientId && r.trialId === trialId)
      if (r) r.status = status
    },
  },

  message: {
    create: (data: Omit<Message, "id" | "createdAt" | "read">): Message => {
      const m: Message = { ...data, id: randomUUID(), createdAt: new Date().toISOString(), read: false }
      g._axiomMessages.set(m.id, m); return m
    },
    findByPatient: (patientId: string): Message[] =>
      Array.from(g._axiomMessages.values())
        .filter(m => m.patientId === patientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    findAll: (): Message[] => Array.from(g._axiomMessages.values()),
    markRead: (id: string) => { const m = g._axiomMessages.get(id); if (m) m.read = true },
  },

  logistics: {
    upsert: (data: Omit<LogisticsRecord, "receivedAt">): LogisticsRecord => {
      const r: LogisticsRecord = { ...data, receivedAt: Date.now() }
      g._axiomLogistics.set(data.patientId, r); return r
    },
    findAll: (): LogisticsRecord[] => Array.from(g._axiomLogistics.values()),
  },

  // Shim for legacy /api/match route
  matchResult: {
    create: async ({ data }: { data: { patientId: string; trialId: string; confidenceScore: number; matchedCriteria: string[] } }) => {
      const user = db.user.findById(data.patientId)
      return db.patientStatus.upsert({
        patientId: data.patientId, trialId: data.trialId, status: "pending",
        lat: user?.lat ?? 42.44, lng: user?.lng ?? -76.50,
        confidenceScore: data.confidenceScore, matchedCriteria: data.matchedCriteria,
      })
    },
  },
}
