// Deprecated — use /api/auth/register instead
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Use /api/auth/register" }, { status: 410 })
}
