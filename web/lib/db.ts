import { randomUUID } from "node:crypto"

// In-memory store — no Prisma/Postgres needed for demo.
// Swap to a real DB by replacing the store methods below.

export interface Message {
  id: string
  patientId: string
  fromName: string
  fromOrg: string
  subject: string
  body: string
  nextSteps: string[]
  trialId: string
  trialName: string
  confidenceScore: number
  createdAt: string
  read: boolean
  contactEmail?: string
  contactPhone?: string
}

export interface Trial {
  id: string
  trialName: string
  criteria: string
  nctId?: string
  coordinator?: string
  contactEmail?: string
  createdAt: string
}

interface MatchRecord {
  id: string
  patientId: string
  trialId: string
  confidenceScore: number
  matchedCriteria: string[]
  createdAt: string
}

interface MedicalRecord {
  fileHash: string
  patientId: string
  deidentifiedSummary: string
  createdAt: string
}

// Global singleton — survives hot reloads in dev
const g = globalThis as unknown as {
  _axiomMessages?: Map<string, Message>
  _axiomMatches?: Map<string, MatchRecord>
  _axiomMedical?: Map<string, MedicalRecord>
  _axiomTrials?: Map<string, Trial>
}

g._axiomMessages ??= new Map()
g._axiomMatches ??= new Map()
g._axiomMedical ??= new Map()
g._axiomTrials ??= new Map()

export const db = {
  message: {
    async create({ data }: { data: Omit<Message, "id" | "createdAt" | "read"> }): Promise<Message> {
      const msg: Message = { ...data, id: randomUUID(), createdAt: new Date().toISOString(), read: false }
      g._axiomMessages!.set(msg.id, msg)
      return msg
    },
    async findMany({ where }: { where: { patientId: string } }): Promise<Message[]> {
      return Array.from(g._axiomMessages!.values())
        .filter((m) => m.patientId === where.patientId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async markRead(id: string): Promise<void> {
      const msg = g._axiomMessages!.get(id)
      if (msg) msg.read = true
    },
  },

  matchResult: {
    async create({ data }: { data: Omit<MatchRecord, "id" | "createdAt"> }): Promise<MatchRecord> {
      const record: MatchRecord = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
      g._axiomMatches!.set(record.id, record)
      return record
    },
    async findMany({ where }: { where: { patientId?: string; trialId?: string } }): Promise<MatchRecord[]> {
      return Array.from(g._axiomMatches!.values()).filter((r) => {
        if (where.patientId && r.patientId !== where.patientId) return false
        if (where.trialId && r.trialId !== where.trialId) return false
        return true
      })
    },
  },

  medicalRecord: {
    async upsert({ where, update, create }: {
      where: { fileHash: string }
      update: Partial<MedicalRecord>
      create: Omit<MedicalRecord, "createdAt">
    }): Promise<MedicalRecord> {
      const existing = Array.from(g._axiomMedical!.values()).find((r) => r.fileHash === where.fileHash)
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const record: MedicalRecord = { ...create, createdAt: new Date().toISOString() }
      g._axiomMedical!.set(create.fileHash, record)
      return record
    },
  },

  user: {
    async upsert({ where }: { where: { id: string }; update: object; create: object }) {
      return { id: where.id }
    },
  },

  trial: {
    async create({ data }: { data: Omit<Trial, "id" | "createdAt"> }): Promise<Trial> {
      const record: Trial = { ...data, id: randomUUID(), createdAt: new Date().toISOString() }
      g._axiomTrials!.set(record.id, record)
      return record
    },
    async findMany(): Promise<Trial[]> {
      return Array.from(g._axiomTrials!.values())
    },
  },
}
