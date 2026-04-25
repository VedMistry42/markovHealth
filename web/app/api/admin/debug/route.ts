import { NextResponse } from "next/server"
import "@/lib/db"

const g = globalThis as unknown as {
  _axiomUsers: Map<string, { id: string; email: string; role: string; name: string }>
  _axiomMedical: Map<string, { patientId: string; fileHash: string }>
  _axiomTrials: Map<string, { id: string; name: string }>
  _axiomStatus: Map<string, { id: string; patientId: string; trialId: string; status: string }>
  _axiomMessages: Map<string, { id: string; patientId: string; subject: string; fromName: string }>
}

export async function GET() {
  return NextResponse.json({
    users: Array.from(g._axiomUsers.values()).map(u => ({ id: u.id, email: u.email, role: u.role, name: u.name })),
    trials: Array.from(g._axiomTrials.values()).map(t => ({ id: t.id, name: t.name })),
    statuses: Array.from(g._axiomStatus.values()),
    messages: Array.from(g._axiomMessages.values()).map(m => ({
      id: m.id, patientId: m.patientId, subject: m.subject, from: m.fromName
    })),
    medicalRecords: Array.from(g._axiomMedical.values()).map(r => ({ patientId: r.patientId, hash: r.fileHash.slice(0,8) })),
  })
}
