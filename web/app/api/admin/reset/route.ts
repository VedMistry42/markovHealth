import { NextResponse } from "next/server"

// Import db to ensure globalThis maps are initialized
import "@/lib/db"

const g = globalThis as unknown as {
  _axiomUsers: Map<string, { id: string; email: string }>
  _axiomMedical: Map<string, { patientId: string }>
  _axiomTrials: Map<string, unknown>
  _axiomStatus: Map<string, unknown>
  _axiomMessages: Map<string, unknown>
  _axiomLogistics: Map<string, unknown>
}

const DEMO_IDS = new Set(["demo-alice", "demo-carlos", "demo-maria"])

export async function POST() {
  // Remove non-demo users
  for (const [id] of Array.from(g._axiomUsers.entries())) {
    if (!DEMO_IDS.has(id)) g._axiomUsers.delete(id)
  }

  // Remove non-demo medical records
  for (const [hash, record] of Array.from(g._axiomMedical.entries())) {
    if (!DEMO_IDS.has(record.patientId)) g._axiomMedical.delete(hash)
  }

  g._axiomTrials.clear()
  g._axiomStatus.clear()
  g._axiomMessages.clear()
  g._axiomLogistics.clear()

  return NextResponse.json({
    ok: true,
    message: "Database reset. Demo patients preserved. All trials, matches, and messages cleared.",
    demoPatients: ["Alice Martinez", "Carlos Rivera", "Maria Johnson"],
    userCount: g._axiomUsers.size,
    recordCount: g._axiomMedical.size,
  })
}
