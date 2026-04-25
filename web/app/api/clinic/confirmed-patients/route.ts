import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Only expose patients that have been actively contacted or confirmed — not just matched
  const statuses = db.patientStatus.findAll().filter(
    s => s.status === "contacted" || s.status === "accepted"
  )

  const result = statuses.map((s) => {
    const patient = db.user.findById(s.patientId)
    return {
      id:        s.id,
      patientId: s.patientId,
      trialId:   s.trialId,
      status:    s.status === "accepted" ? "CONFIRMED" : "PENDING",
      lat:       s.lat,
      lng:       s.lng,
      patientName: patient?.name ?? "Patient",
      condition:   "Oncology",
      email: s.status === "accepted" ? patient?.email ?? "" : "",
      phone: s.status === "accepted" ? patient?.phone ?? "" : "",
    }
  })

  return NextResponse.json(result)
}
