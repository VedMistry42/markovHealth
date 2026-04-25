"use client"
import { motion } from "framer-motion"
import TrialCard from "./TrialCard"
import type { TrialMatch } from "@/types"

interface DashboardGridProps {
  matches: TrialMatch[]
}

export default function DashboardGrid({ matches }: DashboardGridProps) {
  if (matches.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-16 text-gray-600"
      >
        <p className="text-sm">No eligible trials found for this patient profile.</p>
        <p className="text-xs mt-2">Check back as new trials are added regularly.</p>
      </motion.div>
    )
  }

  return (
    <div className="w-full max-w-xl mx-auto mt-8">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-sm text-gray-500 mb-4"
      >
        {matches.length} trial{matches.length > 1 ? "s" : ""} matched your profile
      </motion.p>
      <div className="flex flex-col gap-4">
        {matches.map((match, i) => (
          <TrialCard
            key={match.trialId}
            index={i}
            trialName={match.trialName}
            confidenceScore={match.confidenceScore}
            location={match.location}
            matchedCriteria={match.matchedCriteria}
          />
        ))}
      </div>
    </div>
  )
}
