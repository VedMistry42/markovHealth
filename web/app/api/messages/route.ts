import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// Patient: GET their own messages
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "patient") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const messages = db.message.findByPatient(session.user.id)
  return NextResponse.json(messages)
}

// Clinic: POST a message to a specific patient
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const patientId = String(body.patientId ?? "")
  if (!patientId) return NextResponse.json({ error: "patientId required" }, { status: 400 })

  const researcher = db.user.findById(session.user.id)

  const msg = db.message.create({
    patientId,
    trialId:         String(body.trialId ?? ""),
    trialName:       String(body.trialName ?? "Clinical Trial"),
    confidenceScore: Number(body.confidenceScore ?? 85),
    fromOrg:         researcher?.orgName ?? session.user.name,
    fromName:        researcher?.name ?? session.user.name,
    contactEmail:    researcher?.email ?? session.user.email,
    contactPhone:    researcher?.phone ?? session.user.phone ?? "",
    subject:         String(body.subject ?? `You've been matched to a clinical trial`),
    body:            String(body.body ?? ""),
    nextSteps:       Array.isArray(body.nextSteps) ? body.nextSteps.map(String) : [],
  })

  // Update patient status to "contacted"
  db.patientStatus.setStatus(patientId, String(body.trialId ?? ""), "contacted")

  return NextResponse.json(msg)
}

// Patient: PATCH to mark read OR confirm interest
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id, confirm } = body
  if (!id) return NextResponse.json({ error: "Message id required" }, { status: 400 })

  db.message.markRead(String(id))

  if (confirm) {
    // Find the message to get trialId
    const allMsgs = db.message.findAll()
    const msg = allMsgs.find(m => m.id === String(id))
    if (msg) {
      const patient = db.user.findById(session.user.id)
      db.patientStatus.setStatus(session.user.id, msg.trialId, "accepted")
      // Side-effect: log for analytics (no PHI)
      console.log(`[CONFIRM] Patient ${session.user.id} accepted trial ${msg.trialId}`)
      return NextResponse.json({
        success: true,
        // Return patient contact info to include in response
        patientContact: {
          name:  patient?.name ?? "",
          email: patient?.email ?? "",
          phone: patient?.phone ?? "",
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
