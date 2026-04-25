"use client"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

export type UploadState = "idle" | "uploading" | "processing" | "matched" | "no-match" | "error"

interface ProgressBarProps {
  state: UploadState
}

const STATE_CONFIG: Record<UploadState, { label: string; color: string; width: string }> = {
  idle:       { label: "",                    color: "bg-gray-200",   width: "w-0" },
  uploading:  { label: "Uploading records…",  color: "bg-rose-400",   width: "w-1/3" },
  processing: { label: "Analyzing with AI…",  color: "bg-rose-500",   width: "w-2/3" },
  matched:    { label: "Records saved safely",  color: "bg-emerald-500", width: "w-full" },
  "no-match": { label: "No current matches",  color: "bg-amber-500",  width: "w-full" },
  error:      { label: "Analysis failed",     color: "bg-red-500",    width: "w-full" },
}

export default function ProgressBar({ state }: ProgressBarProps) {
  if (state === "idle") return null

  const { label, color, width } = STATE_CONFIG[state]

  return (
    <div className="w-full max-w-xl mx-auto mt-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {(state === "uploading" || state === "processing") && (
            <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
          )}
          {state === "matched" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {(state === "no-match" || state === "error") && <XCircle className="w-4 h-4 text-amber-500" />}
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
      </div>
      <div className="w-full h-1.5 bg-rose-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: "0%" }}
          animate={{ width: width.replace("w-", "").replace("1/3", "33%").replace("2/3", "66%").replace("full", "100%") }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
