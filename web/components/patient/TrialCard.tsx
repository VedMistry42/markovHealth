"use client"
import { motion } from "framer-motion"
import { MapPin, CheckCircle2 } from "lucide-react"

interface TrialCardProps {
  trialName: string
  confidenceScore: number
  location: string
  matchedCriteria: string[]
  index: number
}

function ConfidenceRing({ score }: { score: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="#ffe4e6" strokeWidth="6" />
        <motion.circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (score / 100) * circumference }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center bg-white rounded-full m-1 shadow-sm">
        <span className="text-sm font-bold text-gray-900">{score}%</span>
      </div>
    </div>
  )
}

export default function TrialCard({ trialName, confidenceScore, location, matchedCriteria, index }: TrialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white border border-rose-100 rounded-3xl p-6 hover:shadow-md hover:border-rose-200 transition-all"
    >
      <div className="flex items-start gap-4 mb-4">
        <ConfidenceRing score={confidenceScore} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1">
            {trialName}
          </h3>
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>{location}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {matchedCriteria.map((criterion, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 + i * 0.05 + 0.4 }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            <span className="text-xs font-medium text-emerald-800">{criterion}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
