import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json(db.logistics.findAll())
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const record = db.logistics.upsert({
    patientId:   String(body.patientId ?? ""),
    trialId:     String(body.trialId ?? ""),
    patientName: String(body.patientName ?? ""),
    lat:         Number(body.lat ?? 0),
    lng:         Number(body.lng ?? 0),
    route:       (body.route as object) ?? {},
  })
  return NextResponse.json(record)
}
