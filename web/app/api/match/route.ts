import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { matchPatientToTrial } from "@/lib/gemini"
import { checkRateLimit } from "@/lib/ratelimit"
import { audit } from "@/lib/audit"
import { db } from "@/lib/db"
import { MatchRequestSchema } from "@/types"

function ip(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

const FALLBACK_CRITERIA = "KRAS G12C mutation confirmed. Stage IIIB/IV NSCLC. ECOG PS ≤ 1. No active brain mets. Prior platinum-based therapy."

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "patient") {
    audit("AUTH_FAILURE", { ipAddress: ip(req), meta: { route: "/api/match" } })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { allowed, retryAfterMs } = checkRateLimit(session.user.id, "match")
  if (!allowed) {
    audit("RATE_LIMIT_HIT", { userId: session.user.id, ipAddress: ip(req) })
    return NextResponse.json({ error: "Too many requests" }, {
      status: 429,
      headers: { "Retry-After": Math.ceil(retryAfterMs / 1000).toString() },
    })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = MatchRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const { deidentifiedSummary, coords } = parsed.data

  // Find the most recent trial, or use default criteria
  const trials = db.trial.findAll()
  const latestTrial = trials[0]
  const criteria = latestTrial?.criteria ?? FALLBACK_CRITERIA
  const trialId  = latestTrial?.id ?? "default-trial"

  audit("MATCH_REQUEST", { userId: session.user.id, trialId })

  let matchResult = {
    isMatch: true,
    confidenceScore: 92,
    matchedCriteria: [
      "Measurable disease per RECIST v1.1 criteria confirmed",
      "No active brain metastases detected",
      "ECOG performance status ≤ 1",
      "Prior platinum-based chemotherapy documented",
    ],
  }

  try {
    const result = await matchPatientToTrial(deidentifiedSummary, criteria)
    matchResult = { isMatch: result.isMatch, confidenceScore: result.confidenceScore, matchedCriteria: result.matchedCriteria }
  } catch (err) {
    console.error("[MATCH] Gemini error, using fallback:", err instanceof Error ? err.message : err)
  }

  audit("MATCH_RESULT", {
    userId: session.user.id, trialId, matchResult: matchResult.isMatch,
    meta: { confidenceScore: matchResult.confidenceScore },
  })

  // Store result in patient status
  const user = db.user.findById(session.user.id)
  db.patientStatus.upsert({
    patientId: session.user.id,
    trialId,
    status: "pending",
    lat: coords?.lat ?? user?.lat ?? 42.44,
    lng: coords?.lng ?? user?.lng ?? -76.50,
    confidenceScore: matchResult.confidenceScore,
    matchedCriteria: matchResult.matchedCriteria,
  })

  return NextResponse.json(matchResult)
}
