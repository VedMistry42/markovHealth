"use client"
import { motion } from "framer-motion"
import { Activity, Users, TrendingUp, Clock, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { TRIAL_NAME, TRIAL_ID, HUBS, MOCK_PATIENTS } from "@/data/mockTrialCriteria"

const TRIAL_PORTFOLIO = [
  {
    id: TRIAL_ID,
    name: TRIAL_NAME,
    phase: "Phase II",
    status: "Enrolling",
    indication: "Advanced NSCLC",
    biomarker: "KRAS G12C",
    sponsor: "Axiom Oncology Research",
    sites: HUBS.map((h) => h.city),
    enrolled: MOCK_PATIENTS.filter((p) => p.status !== "pending").length,
    target: 80,
    matchRate: 62,
    avgConfidence: 79,
    lastActivity: "2 hours ago",
    milestones: [
      { label: "Protocol approved", done: true },
      { label: "Sites activated", done: true },
      { label: "First patient enrolled", done: true },
      { label: "50% enrollment", done: false },
      { label: "Primary endpoint", done: false },
    ],
  },
  {
    id: "trial-onco-002",
    name: "Phase I: Anti-PD-L1 + VEGF Inhibitor Combo in Solid Tumors",
    phase: "Phase I",
    status: "Active — Dose Escalation",
    indication: "Solid Tumors",
    biomarker: "PD-L1 ≥ 1%",
    sponsor: "Axiom Oncology Research",
    sites: ["Boston, MA", "Houston, TX"],
    enrolled: 14,
    target: 30,
    matchRate: 38,
    avgConfidence: 71,
    lastActivity: "Yesterday",
    milestones: [
      { label: "Protocol approved", done: true },
      { label: "Sites activated", done: true },
      { label: "Dose level 1 complete", done: true },
      { label: "Dose level 2 complete", done: false },
      { label: "RP2D determined", done: false },
    ],
  },
  {
    id: "trial-onco-003",
    name: "Phase III: Adjuvant Osimertinib vs. Observation in Resected EGFR+ NSCLC",
    phase: "Phase III",
    status: "Enrolling",
    indication: "EGFR+ NSCLC (Resected)",
    biomarker: "EGFR exon 19/21",
    sponsor: "Global Oncology Alliance",
    sites: ["New York, NY", "Los Angeles, CA", "Chicago, IL", "Seattle, WA"],
    enrolled: 201,
    target: 400,
    matchRate: 55,
    avgConfidence: 83,
    lastActivity: "3 hours ago",
    milestones: [
      { label: "Protocol approved", done: true },
      { label: "50% enrollment", done: false },
      { label: "Interim analysis", done: false },
      { label: "Primary endpoint", done: false },
    ],
  },
]

function EnrollmentBar({ enrolled, target }: { enrolled: number; target: number }) {
  const pct = Math.min(100, Math.round((enrolled / target) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>{enrolled} enrolled</span>
        <span>{pct}% of {target}</span>
      </div>
      <div className="w-full h-2 bg-rose-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

export default function TrialStatusPage() {
  return (
    <div className="min-h-screen bg-rose-50/30">
      <div className="border-b border-rose-100 bg-white px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/clinic" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 transition-colors font-medium">
          <ChevronLeft className="w-4 h-4" />Back to Map
        </Link>
        <div className="w-px h-5 bg-rose-100" />
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-500" />
          <span className="font-semibold text-gray-900">Trial Portfolio</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Active Clinical Trials</h1>
          <p className="text-gray-500 text-sm">{TRIAL_PORTFOLIO.length} trials · Enrollment status updated in real-time</p>
        </div>

        <div className="space-y-6">
          {TRIAL_PORTFOLIO.map((trial, idx) => (
            <motion.div
              key={trial.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white border border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">{trial.phase}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      trial.status.includes("Enrolling") ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>{trial.status}</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{trial.lastActivity}</span>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 leading-snug mb-1">{trial.name}</h2>
                  <p className="text-sm text-gray-500">{trial.indication} · <span className="font-medium text-rose-600">{trial.biomarker}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="bg-rose-50 rounded-2xl p-3 text-center border border-rose-100">
                  <Users className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{trial.enrolled}</p>
                  <p className="text-xs text-gray-500">Enrolled</p>
                </div>
                <div className="bg-indigo-50 rounded-2xl p-3 text-center border border-indigo-100">
                  <TrendingUp className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{trial.matchRate}%</p>
                  <p className="text-xs text-gray-500">Match Rate</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                  <Activity className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{trial.avgConfidence}%</p>
                  <p className="text-xs text-gray-500">Avg. Confidence</p>
                </div>
              </div>

              <EnrollmentBar enrolled={trial.enrolled} target={trial.target} />

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sites</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trial.sites.map((site) => (
                      <span key={site} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-1 rounded-lg">{site}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Milestones</p>
                  <div className="space-y-1">
                    {trial.milestones.slice(0, 4).map((m) => (
                      <div key={m.label} className="flex items-center gap-2 text-xs">
                        {m.done
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          : <AlertCircle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                        <span className={m.done ? "text-gray-600" : "text-gray-400"}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  )
}
