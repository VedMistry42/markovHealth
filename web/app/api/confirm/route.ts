// Deprecated — confirmation now happens via PATCH /api/messages
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Use PATCH /api/messages with confirm:true" }, { status: 410 })
}
