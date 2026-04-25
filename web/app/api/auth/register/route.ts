import { NextRequest, NextResponse } from "next/server"
import { db, hashPassword, zipToCoords } from "@/lib/db"

export async function POST(req: NextRequest) {
  let body: Record<string, string>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { role, name, email, password, phone, story, orgName, specialty, zip } = body

  if (!role || !email || !password || !name) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }
  if (role !== "patient" && role !== "researcher") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const existing = db.user.findByEmail(email)
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const coords = zip ? zipToCoords(zip) : { lat: 40.71, lng: -74.01 }

  const user = db.user.create({
    email,
    passwordHash: hashPassword(password),
    role: role as "patient" | "researcher",
    name,
    phone: phone ?? "",
    story: story ?? "",
    orgName: orgName ?? "",
    specialty: specialty ?? "",
    lat: coords.lat,
    lng: coords.lng,
    zip: zip ?? "",
  })

  return NextResponse.json({ id: user.id, email: user.email, role: user.role })
}
