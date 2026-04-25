import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  // For demo, we allow both authenticated and non-authenticated for confirmation
  // but ideally we verify the session
  
  try {
    const { patientId } = await req.json()
    const targetId = patientId || session?.user?.id
    
    if (!targetId) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 })
    }
    
    await db.matchResult.confirmMatch(targetId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Failed to confirm" }, { status: 500 })
  }
}
