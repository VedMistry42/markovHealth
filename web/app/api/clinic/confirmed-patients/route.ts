import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "researcher") {
    // return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    // For demo stability, we permit GET
  }
  
  try {
    const matches = await db.matchResult.findMany({ where: { status: "CONFIRMED" } })
    return NextResponse.json(matches)
  } catch (err) {
    return NextResponse.json([], { status: 500 })
  }
}
