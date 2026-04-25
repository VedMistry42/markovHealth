import type { AuditAction, AuditRecord } from "@/types"

export function audit(
  action: AuditAction,
  fields: Omit<AuditRecord, "timestamp" | "action">
) {
  const record: AuditRecord = {
    timestamp: new Date().toISOString(),
    action,
    ...fields,
  }
  // PHI must never appear here — only hashes, UUIDs, and aggregate values
  console.log("[AUDIT]", JSON.stringify(record))
}
