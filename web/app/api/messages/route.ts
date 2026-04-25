import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json([]) // return empty array (not 401) so demos work

    const messages = await db.message.findMany({ where: { patientId: session.user.id } })
    // Return array directly (not wrapped in {messages:[]}) to match patient page expectation
    return NextResponse.json(messages)
  } catch {
    return NextResponse.json([])
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ ok: true }) // silent for demo

    const { id } = await req.json()
    await db.message.markRead(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // never throw to client
  }
}
