import { GoogleGenerativeAI } from "@google/generative-ai"
import { ClaudeMatchOutputSchema, type ClaudeMatchOutput } from "@/types"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

// Use flash for speed — structured JSON output via responseMimeType, no schema import needed
const matchModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" },
})

const messageModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" },
})

export async function matchPatientToTrial(
  deidentifiedSummary: string,
  trialCriteria: string
): Promise<ClaudeMatchOutput> {
  const prompt = `You are an expert clinical trial eligibility screener.
Assess the de-identified patient summary against the trial criteria below.
Be conservative: only mark isMatch=true if the patient clearly meets the key inclusion criteria.
Return ONLY a JSON object with exactly these keys:
- isMatch: boolean
- confidenceScore: integer 1-100
- matchedCriteria: array of strings describing each matched or relevant criterion

TRIAL CRITERIA:
${trialCriteria}

PATIENT SUMMARY (DE-IDENTIFIED):
${deidentifiedSummary}`

  const result = await matchModel.generateContent(prompt)
  const text = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim()

  return ClaudeMatchOutputSchema.parse(JSON.parse(text))
}

export async function generateMatchMessage(params: {
  patientFirstName: string
  trialName: string
  hospitalName: string
  matchedCriteria: string[]
  confidenceScore: number
  trialId: string
}): Promise<{ subject: string; body: string; nextSteps: string[] }> {
  const { patientFirstName, trialName, hospitalName, matchedCriteria, confidenceScore } = params

  const prompt = `You are a compassionate clinical trial coordinator at ${hospitalName}.
Write a warm, personal message to a patient named ${patientFirstName} who has been matched to the trial "${trialName}" (${confidenceScore}% match).

Key matched criteria: ${matchedCriteria.slice(0, 3).join("; ")}

Important: We handle ALL logistics — we ship genomic collection kits to their home, coordinate travel to the nearest hub, and have mobile units that come to them. Emphasize this.

Return ONLY a JSON object with exactly these keys:
- subject: string (warm, specific email subject line)
- body: string (3 paragraphs: 1. personalized greeting and match confirmation, 2. what this trial offers them in plain language and that we handle all logistics, 3. exact next steps and how to reach us)
- nextSteps: array of 4 strings (concrete numbered next steps for the patient)`

  const result = await messageModel.generateContent(prompt)
  const text = result.response.text().replace(/```json/gi, "").replace(/```/g, "").trim()

  try {
    return JSON.parse(text)
  } catch {
    return {
      subject: `You've been matched to ${trialName} — we handle everything`,
      body: `Dear ${patientFirstName},\n\nWe're excited to share that you've been identified as a strong match (${confidenceScore}%) for our clinical trial "${trialName}" at ${hospitalName}.\n\nThis trial may offer you access to a targeted therapy specifically designed for your tumor profile. And here's what makes us different: we come to you. We'll ship a genomic collection kit directly to your home, and if you qualify for the next stage, we coordinate all travel and logistics — at no cost to you.\n\nTo get started, simply confirm your interest by clicking the button below. Our coordinator will reach out within 24 hours to walk you through next steps personally.`,
      nextSteps: [
        "Confirm your interest by clicking the button below",
        "Expect a call from our coordinator within 24 hours",
        "Receive your at-home genomic collection kit by mail",
        "We coordinate all travel and logistics — nothing is on you",
      ],
    }
  }
}
