import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const statuses = db.patientStatus.findAll()
  const result = statuses.map((s) => {
    const patient = db.user.findById(s.patientId)
    const trial   = db.trial.findById(s.trialId)
    return {
      id:              s.id,
      patientId:       s.patientId,
      trialId:         s.trialId,
      status:          s.status,
      lat:             s.lat,
      lng:             s.lng,
      confidenceScore: s.confidenceScore,
      matchedCriteria: s.matchedCriteria,
      trialName:       trial?.name ?? "Unknown Trial",
      // Patient info — always visible for story/matching
      name:     patient?.name ?? "Anonymous",
      age:      "—",
      location: patient?.zip ?? "—",
      story:    patient?.story ?? "",
      // Contact info only visible after acceptance
      email:    s.status === "accepted" ? patient?.email ?? "" : "",
      phone:    s.status === "accepted" ? patient?.phone ?? "" : "",
    }
  })

  return NextResponse.json(result)
}
