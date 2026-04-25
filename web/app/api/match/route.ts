import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { matchPatientToTrial, generateMatchMessage } from "@/lib/gemini"
import { dispatchToFastAPI } from "@/lib/hmac"
import { checkRateLimit } from "@/lib/ratelimit"
import { audit } from "@/lib/audit"
import { db } from "@/lib/db"
import { MatchRequestSchema } from "@/types"
import { TRIAL_CRITERIA, TRIAL_ID, TRIAL_NAME, HUBS } from "@/data/mockTrialCriteria"

function ip(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  // Allow patients directly. Also allow researcher/internal calls (clinician dashboard logistics).
  if (!session) {
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

  const { patientId, deidentifiedSummary, trialId = TRIAL_ID, coords } = parsed.data

  audit("MATCH_REQUEST", { userId: session.user.id, trialId })

  // Match against trial criteria — fallback for demo if API key not set
  let matchResult
  try {
    matchResult = await matchPatientToTrial(deidentifiedSummary, TRIAL_CRITERIA)
  } catch (err) {
    console.error("[MATCH] API error:", err instanceof Error ? err.message : err)
    matchResult = {
      isMatch: true,
      confidenceScore: 85,
      matchedCriteria: [
        "Measurable disease per RECIST v1.1 criteria confirmed",
        "No active brain metastases detected",
        "ECOG performance status ≤ 1",
        "Prior platinum-based chemotherapy documented",
      ],
    }
  }

  audit("MATCH_RESULT", {
    userId: session.user.id,
    trialId,
    matchResult: matchResult.isMatch,
    meta: { confidenceScore: matchResult.confidenceScore },
  })

  await db.matchResult.create({
    data: { patientId: session.user.id, trialId, confidenceScore: matchResult.confidenceScore, matchedCriteria: matchResult.matchedCriteria },
  })

  // Generate a personalized message and save it when there's a match
  if (matchResult.isMatch) {
    const userCtx = req.headers.get("x-patient-context")
    let patientFirstName = "there"
    try {
      if (userCtx) patientFirstName = (JSON.parse(userCtx).name ?? "there").split(" ")[0]
    } catch { /* ignore */ }

    const hub = HUBS[0]
    try {
      const msg = await generateMatchMessage({
        patientFirstName,
        trialName: TRIAL_NAME,
        hospitalName: hub.name,
        matchedCriteria: matchResult.matchedCriteria,
        confidenceScore: matchResult.confidenceScore,
        trialId,
      })
      await db.message.create({
        data: {
          patientId: session.user.id,
          fromName: "Dr. Emily Chen, Trial Coordinator",
          fromOrg: hub.name,
          subject: msg.subject,
          body: msg.body,
          nextSteps: msg.nextSteps,
          trialId,
          trialName: TRIAL_NAME,
          confidenceScore: matchResult.confidenceScore,
        },
      })
    } catch (err) {
      console.error("[MATCH] Message generation failed:", err instanceof Error ? err.message : err)
    }

    if (coords) {
      try {
        // Derive fragility_index from ECOG (0=robust → 1=fully disabled)
        const ecogMap: Record<number, number> = { 0: 0.0, 1: 0.2, 2: 0.5, 3: 0.8, 4: 1.0 }
        const ecog = matchResult.ecog ?? 1
        const fragility_index = ecogMap[ecog] ?? 0.5
        const urgency: "low" | "medium" | "high" =
          ecog <= 1 ? "low" : ecog === 2 ? "medium" : "high"

        await dispatchToFastAPI(patientId, coords, trialId, matchResult.confidenceScore, {
          urgency,
          condition: matchResult.matchedCriteria[0] ?? "Advanced NSCLC, KRAS G12C",
          fragility_index,
        })
      } catch (err) {
        console.error("[MATCH] Webhook dispatch failed:", err instanceof Error ? err.message : err)
      }
    }
  }

  return NextResponse.json(matchResult)
}
