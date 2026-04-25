import crypto from "node:crypto"
import { WebhookPayloadSchema } from "@/types"
import { audit } from "@/lib/audit"

export function signPayload(payload: object, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex")
}

export async function dispatchToFastAPI(
  patientId: string,
  coords: { lat: number; lng: number },
  trialId: string,
  confidenceScore: number
): Promise<void> {
  const webhookUrl = process.env.FASTAPI_WEBHOOK_URL
  const webhookSecret = process.env.FASTAPI_WEBHOOK_SECRET

  if (!webhookUrl || !webhookSecret) {
    console.warn("[WEBHOOK] FASTAPI_WEBHOOK_URL or FASTAPI_WEBHOOK_SECRET not set — skipping dispatch")
    return
  }

  // Hash the patient ID — FastAPI never receives the raw UUID
  const hashedPatientId = crypto.createHash("sha256").update(patientId).digest("hex")

  const payload = WebhookPayloadSchema.parse({
    patientId: hashedPatientId,
    lat: coords.lat,
    lng: coords.lng,
    trialId,
    confidenceScore,
  })

  const signature = signPayload(payload, webhookSecret)
  const timestamp = Date.now().toString()

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Axiom-Signature": `sha256=${signature}`,
      "X-Axiom-Timestamp": timestamp, // replay attack prevention — FastAPI rejects if >5 min old
    },
    body: JSON.stringify(payload),
  })

  audit("WEBHOOK_DISPATCH", {
    trialId,
    matchResult: true,
    meta: { status: res.status, hashedPatientId },
  })

  if (!res.ok) {
    throw new Error(`FastAPI webhook returned ${res.status}`)
  }
}
