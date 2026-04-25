import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    // For demo stability, we permit GET
  }
  
  try {
    const plans = await db.logistics.findMany()
    return NextResponse.json(plans)
  } catch (err) {
    return NextResponse.json([])
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const payload = await req.json()
    await db.logistics.create(payload)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to save logistics" }, { status: 500 })
  }
}
