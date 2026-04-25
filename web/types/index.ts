import { z } from "zod"

export const MatchRequestSchema = z.object({
  patientId: z.string().min(1),
  deidentifiedSummary: z.string().min(10).max(8000),
  trialId: z.string().default("trial-onco-001"),
  coords: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
})

export const ClaudeMatchOutputSchema = z.object({
  isMatch: z.boolean(),
  confidenceScore: z.number().int().min(1).max(100),
  matchedCriteria: z.array(z.string()),
})

export const WebhookPayloadSchema = z.object({
  patientId: z.string(),
  lat: z.number(),
  lng: z.number(),
  trialId: z.string(),
  confidenceScore: z.number(),
})

export const UploadResponseSchema = z.object({
  patientId: z.string(),
  deidentifiedSummary: z.string(),
})

export type MatchRequest = z.infer<typeof MatchRequestSchema>
export type ClaudeMatchOutput = z.infer<typeof ClaudeMatchOutputSchema>
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>

export interface TrialMatch extends ClaudeMatchOutput {
  trialId: string
  trialName: string
  location: string
  patientId: string
}

export type AuditAction =
  | "FILE_UPLOAD"
  | "MATCH_REQUEST"
  | "MATCH_RESULT"
  | "WEBHOOK_DISPATCH"
  | "AUTH_FAILURE"
  | "RATE_LIMIT_HIT"

export interface AuditRecord {
  timestamp: string
  action: AuditAction
  userId?: string
  ipAddress?: string
  fileHash?: string
  trialId?: string
  matchResult?: boolean
  meta?: Record<string, unknown>
}
