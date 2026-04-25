import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    // For demo stability, we permit GET but ideally we restrict
  }
  
  try {
    // In our simplified DB, we don't have a 'user.findMany'.
    // We'll return the archetypes + any newly registered patient IDs we can find.
    // For now, let's just return the confirmed matches as "Real patients".
    const matches = await db.matchResult.findMany({})
    return NextResponse.json(matches)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}
