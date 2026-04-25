import { NextRequest, NextResponse } from "next/server"
import { registerUser } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, role, displayName, phone, address } = body

    if (!email || !password || !role || !displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }
    if (!["patient", "researcher"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const result = registerUser({ email, password, role, displayName, phone, address })
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Registration failed" }, { status: 500 })
  }
}
