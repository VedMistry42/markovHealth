import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = db.user.findById(session.user.id)
  if (!user) return NextResponse.json({ error: "No profile found" }, { status: 404 })

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    story: user.story,
    orgName: user.orgName,
    specialty: user.specialty,
    zip: user.zip,
  })
}
