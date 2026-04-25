// PHI scrubber — strips identifiable information before sending to any external API.
// For demo: regex-based. For production: use AWS Comprehend Medical or Microsoft Presidio.

const PHI_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  // SSN
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, label: "[SSN]" },
  // Phone numbers (US)
  { pattern: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: "[PHONE]" },
  // Email
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: "[EMAIL]" },
  // MRN / patient ID patterns
  { pattern: /\b(MRN|Patient\s*ID|Patient\s*#|Chart\s*#)[:\s#]*\d+/gi, label: "[MRN]" },
  // Insurance / Member IDs
  { pattern: /\b(Member\s*ID|Insurance\s*ID|Policy\s*#)[:\s]*[\w-]+/gi, label: "[INS_ID]" },
  // ISO dates (YYYY-MM-DD)
  { pattern: /\b\d{4}-\d{2}-\d{2}\b/g, label: "[DATE]" },
  // US dates (MM/DD/YYYY or MM-DD-YYYY)
  { pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/g, label: "[DATE]" },
  // Written dates (January 1, 2000 / Jan 1 2000)
  {
    pattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    label: "[DATE]",
  },
  // Doctor names: "Dr. Lastname" or "Dr Lastname"
  { pattern: /\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, label: "[PROVIDER]" },
  // Hospital / clinic names (heuristic — proper nouns ending in Hospital/Clinic/Center/Medical)
  { pattern: /\b[A-Z][a-zA-Z\s]+(Hospital|Clinic|Medical Center|Health System|Cancer Center)\b/g, label: "[FACILITY]" },
  // Full names (heuristic: two consecutive capitalized words not preceded by common titles)
  { pattern: /\b(?<!Dr\.?\s)(?<!Mr\.?\s)(?<!Ms\.?\s)(?<!Mrs\.?\s)[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/g, label: "[NAME]" },
  // ZIP codes
  { pattern: /\b\d{5}(-\d{4})?\b/g, label: "[ZIP]" },
  // Street addresses
  { pattern: /\d+\s+[A-Z][a-zA-Z\s]+(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b/gi, label: "[ADDRESS]" },
]

export interface DeidentifyResult {
  deidentifiedText: string
  redactionCount: number
  warnings: string[]
}

export function deidentify(text: string): DeidentifyResult {
  let result = text
  let redactionCount = 0
  const warnings: string[] = []

  for (const { pattern, label } of PHI_PATTERNS) {
    const matches = result.match(pattern)
    if (matches) {
      redactionCount += matches.length
      result = result.replace(pattern, label)
    }
  }

  if (redactionCount === 0) {
    warnings.push("No PHI patterns detected — document may not contain standard medical identifiers.")
  }

  return { deidentifiedText: result, redactionCount, warnings }
}
