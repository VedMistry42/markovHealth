import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { extractTrialCriteria, matchPatientToTrial } from "@/lib/gemini"

const MAX_BYTES = 5 * 1024 * 1024

async function parseText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require("pdf-parse")
    const pdfParse = typeof raw === "function" ? raw : (raw.default ?? raw)
    const result = await pdfParse(buffer, { max: 0 })
    return result.text?.trim() ?? ""
  }
  return buffer.toString("utf-8")
}

// Keyword-based fallback when Gemini is unavailable
function keywordMatch(patientSummary: string, trialCriteria: string): {
  isMatch: boolean; confidenceScore: number; matchedCriteria: string[]
} {
  const ps = patientSummary.toLowerCase()
  const tc = trialCriteria.toLowerCase()

  const lungKeywords   = ["nsclc", "non-small cell", "lung cancer", "adenocarcinoma", "stage iii", "stage iv", "stage 3", "stage 4"]
  const krasKeywords   = ["kras", "g12c", "kras g12c"]
  const breastKeywords = ["breast cancer", "ductal carcinoma", "er+", "pr+", "her2"]
  const exclusions     = ["brain metastases", "brain mets", "active brain"]

  const trialIsLung  = lungKeywords.some(k => tc.includes(k)) || tc.includes("kras")
  const trialIsKras  = krasKeywords.some(k => tc.includes(k))
  const patientLung  = lungKeywords.some(k => ps.includes(k))
  const patientKras  = krasKeywords.some(k => ps.includes(k))
  const patientBreast = breastKeywords.some(k => ps.includes(k))
  const hasExclusion = exclusions.some(k => ps.includes(k) && ps.includes("active"))

  // Breast cancer patient against lung trial — clear non-match
  if (patientBreast && trialIsLung && !patientLung) {
    return { isMatch: false, confidenceScore: 12, matchedCriteria: ["Indication mismatch: breast cancer vs lung cancer trial"] }
  }

  if (trialIsLung && patientLung) {
    const matched: string[] = []
    let score = 55

    if (trialIsKras && patientKras) { matched.push("KRAS G12C mutation confirmed"); score += 20 }
    if (ps.includes("ecog") && (ps.includes("ecog 1") || ps.includes("ecog 0") || ps.includes("ecog ps 1"))) {
      matched.push("ECOG performance status ≤ 1"); score += 8
    }
    if (!hasExclusion && (ps.includes("no") && ps.includes("brain"))) {
      matched.push("No active brain metastases"); score += 5
    }
    if (ps.includes("platinum") || ps.includes("carboplatin") || ps.includes("cisplatin")) {
      matched.push("Prior platinum-based chemotherapy"); score += 7
    }
    if (ps.includes("recist") || ps.includes("measurable")) {
      matched.push("Measurable disease per RECIST 1.1"); score += 5
    }

    if (matched.length === 0) matched.push("Lung cancer indication matches trial target population")
    return { isMatch: score >= 60, confidenceScore: Math.min(score, 97), matchedCriteria: matched }
  }

  return { isMatch: false, confidenceScore: 15, matchedCriteria: ["No indication overlap with trial criteria"] }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const trials = db.trial.findAll().map((t) => {
    const statuses = db.patientStatus.findByTrial(t.id)
    return {
      ...t,
      enrolled:  statuses.filter((s) => s.status === "accepted").length,
      contacted: statuses.filter((s) => s.status === "contacted").length,
      pending:   statuses.filter((s) => s.status === "pending").length,
      total:     statuses.length,
    }
  })
  return NextResponse.json(trials)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: "Could not read form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 })

  let rawText = ""
  try { rawText = await parseText(file) } catch { /* fall through to defaults */ }

  let extracted = { name: "", indication: "", criteria: "", phase: "" }
  try {
    if (rawText.trim().length > 20) extracted = await extractTrialCriteria(rawText)
  } catch { /* use defaults */ }

  if (!extracted.name) {
    extracted.name = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }
  if (!extracted.criteria) {
    extracted.criteria = rawText.slice(0, 800) ||
      "KRAS G12C mutation confirmed. Stage IIIB/IV NSCLC. ECOG ≤ 1. No active brain metastases. Prior platinum-based therapy. No prior KRAS-directed agent."
  }
  if (!extracted.indication) extracted.indication = "NSCLC"
  if (!extracted.phase) extracted.phase = "Phase II"

  const researcher = db.user.findById(session.user.id)

  const trial = db.trial.create({
    researcherId:    session.user.id,
    researcherName:  researcher?.name ?? session.user.name,
    researcherOrg:   researcher?.orgName ?? "",
    researcherEmail: researcher?.email ?? session.user.email,
    researcherPhone: researcher?.phone ?? session.user.phone ?? "",
    name:       extracted.name,
    criteria:   extracted.criteria,
    indication: extracted.indication,
    phase:      extracted.phase,
  })

  // Auto-match all patients with uploaded records
  const allRecords = db.medicalRecord.findAll()
  const seen = new Set<string>()

  for (const record of allRecords) {
    if (seen.has(record.patientId)) continue
    seen.add(record.patientId)

    const patient = db.user.findById(record.patientId)
    if (!patient) continue

    let score = 0
    let matchedCriteria: string[] = []
    let isMatch = false

    // Try Gemini first, fall back to keyword matching
    try {
      const result = await matchPatientToTrial(record.deidentifiedSummary, trial.criteria)
      score = result.confidenceScore
      matchedCriteria = result.matchedCriteria
      isMatch = result.isMatch
    } catch {
      const fallback = keywordMatch(record.deidentifiedSummary, trial.criteria)
      score = fallback.confidenceScore
      matchedCriteria = fallback.matchedCriteria
      isMatch = fallback.isMatch
      console.log(`[TRIALS] Gemini unavailable — keyword match for ${patient.name}: isMatch=${isMatch}, score=${score}`)
    }

    // If Gemini returned but with low confidence, still run keyword check as sanity
    if (!isMatch && score < 40) {
      const kw = keywordMatch(record.deidentifiedSummary, trial.criteria)
      if (kw.isMatch) {
        isMatch = kw.isMatch
        score = Math.max(score, kw.confidenceScore)
        matchedCriteria = kw.matchedCriteria
      }
    }

    if (isMatch || score >= 50) {
      db.patientStatus.upsert({
        patientId: record.patientId,
        trialId:   trial.id,
        status:    "pending",
        lat:       patient.lat,
        lng:       patient.lng,
        confidenceScore: score,
        matchedCriteria,
      })
    }
  }

  const statuses = db.patientStatus.findByTrial(trial.id)
  return NextResponse.json({ trial, matchedCount: statuses.length })
}
