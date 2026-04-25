"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Users, TrendingUp, Clock, ChevronLeft, CheckCircle2,
  Upload, X, ChevronDown, ChevronUp, Zap, MapPin, RefreshCw
} from "lucide-react"
import Link from "next/link"
import { PATIENT_ARCHETYPES } from "@/lib/sampleData"

// Match scores per patient for each trial slot
const SCORES: Record<string, number> = {
  "arch-1": 98, "arch-2": 45, "arch-3": 12, "arch-4": 87, "arch-5": 72, "arch-6": 91,
}

type PatientStatus = "pending" | "matched" | "dispatched" | "confirmed"

interface PatientEnrollment {
  archId: string
  status: PatientStatus
  action?: string
}

interface LiveTrial {
  id: string
  trialName: string
  criteria: string
  coordinator?: string
  contactEmail?: string
  createdAt: string
  patients: PatientEnrollment[]
}

function StatusBadge({ status }: { status: PatientStatus }) {
  const cfg: Record<PatientStatus, { label: string; cls: string }> = {
    pending:   { label: "Pending",   cls: "bg-gray-100 text-gray-500 border-gray-200" },
    matched:   { label: "Matched",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
    dispatched:{ label: "Dispatched",cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    confirmed: { label: "Confirmed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  }
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${cfg[status].cls}`}>
      {cfg[status].label}
    </span>
  )
}

function EnrollmentBar({ count, target }: { count: number; target: number }) {
  const pct = Math.min(100, Math.round((count / target) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{count} enrolled</span>
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

function TrialCard({ trial, onDelete }: { trial: LiveTrial; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null)
  const [patients, setPatients] = useState<PatientEnrollment[]>(trial.patients)

  const confirmed = patients.filter(p => p.status === "confirmed").length
  const dispatched = patients.filter(p => p.status === "dispatched").length

  const runLogistics = async (archId: string) => {
    setPatients(prev => prev.map(p => p.archId === archId ? { ...p, status: "dispatched" } : p))
    const archetype = PATIENT_ARCHETYPES.find(a => a.id === archId)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000"}/calculate-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: archId,
          patient_coords: { lat: archetype?.lat ?? 42.444, lng: archetype?.lng ?? -76.5 },
          is_match: true,
          match_data: { condition: "Stage IIIB NSCLC", urgency: "high" },
        }),
      })
    } catch { /* ok — fallback already applied */ }
  }

  const confirmPatient = (archId: string) => {
    setPatients(prev => prev.map(p => p.archId === archId ? { ...p, status: "confirmed" } : p))
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-rose-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">Phase II</span>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">Enrolling</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />{new Date(trial.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug mb-1">{trial.trialName}</h2>
            <p className="text-xs text-gray-400">
              {trial.coordinator && <span className="font-medium text-gray-600">{trial.coordinator}</span>}
              {trial.contactEmail && <> · <a href={`mailto:${trial.contactEmail}`} className="text-indigo-500 hover:underline">{trial.contactEmail}</a></>}
            </p>
          </div>
          <button onClick={() => onDelete(trial.id)} className="text-gray-200 hover:text-red-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-rose-50 rounded-2xl p-3 text-center border border-rose-100">
            <Users className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{patients.length}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Patients</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{dispatched}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Dispatched</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{confirmed}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Confirmed</p>
          </div>
        </div>

        <EnrollmentBar count={confirmed + dispatched} target={patients.length} />

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Hide Patient Roster</> : <><ChevronDown className="w-3.5 h-3.5" />View Patient Roster &amp; Status</>}
        </button>
      </div>

      {/* Patient roster accordion */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-rose-50"
          >
            <div className="p-4 space-y-3 bg-gray-50/50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Matched Patients</p>
              {patients.map(({ archId, status }) => {
                const p = PATIENT_ARCHETYPES.find(a => a.id === archId)
                if (!p) return null
                const score = SCORES[archId] ?? 0
                const isOpen = expandedPatient === archId

                return (
                  <div key={archId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      className="w-full text-left px-4 py-3 flex items-center gap-3"
                      onClick={() => setExpandedPatient(isOpen ? null : archId)}
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-sm font-bold text-rose-600 flex-shrink-0">
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}, {p.age}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${score > 80 ? "text-emerald-500" : score > 40 ? "text-amber-500" : "text-gray-400"}`}>{score}%</span>
                        <StatusBadge status={status} />
                        {isOpen ? <ChevronUp className="w-3 h-3 text-gray-300" /> : <ChevronDown className="w-3 h-3 text-gray-300" />}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                            {/* Story */}
                            <div className="bg-rose-50 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Patient Story</p>
                              <p className="text-xs text-gray-600 italic leading-relaxed">&ldquo;{p.story}&rdquo;</p>
                            </div>

                            {/* Clinical snippet */}
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Clinical Summary</p>
                              <p className="text-[10px] font-mono text-gray-500 leading-relaxed line-clamp-4">{p.clinicalText}</p>
                            </div>

                            {/* RL-driven action area */}
                            {status === "pending" && (
                              <button
                                onClick={() => runLogistics(archId)}
                                className="w-full py-2 rounded-xl text-xs font-bold bg-gray-900 text-white flex items-center justify-center gap-2 shadow hover:bg-gray-800 transition-colors"
                              >
                                <Zap className="w-3 h-3" />Run RL Logistics Engine
                              </button>
                            )}
                            {status === "dispatched" && (
                              <div className="space-y-2">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700 flex justify-between">
                                  <span>✓ Mobile Unit Dispatch (RL Score: +47.80)</span>
                                  <span className="text-emerald-400">Selected</span>
                                </div>
                                <button
                                  onClick={() => confirmPatient(archId)}
                                  className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow transition-colors"
                                >
                                  <CheckCircle2 className="w-3 h-3" />Confirm Enrollment
                                </button>
                              </div>
                            )}
                            {status === "confirmed" && (
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 py-1">
                                <CheckCircle2 className="w-4 h-4" />Enrolled & Logistics Confirmed
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Seed patient list for a newly uploaded trial
function makePatients(): PatientEnrollment[] {
  return PATIENT_ARCHETYPES.map(a => ({
    archId: a.id,
    status: (SCORES[a.id] ?? 0) > 80 ? "matched" : "pending",
  }))
}

export default function TrialStatusPage() {
  const [trials, setTrials] = useState<LiveTrial[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTrials = useCallback(async () => {
    try {
      const res = await fetch("/api/trials")
      if (!res.ok) return
      const data = await res.json()
      setTrials((data.trials ?? []).map((t: LiveTrial) => ({
        ...t,
        patients: t.patients?.length ? t.patients : makePatients(),
      })))
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTrials() }, [fetchTrials])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch("/api/trials", { method: "POST", body: formData })
      if (res.ok) await fetchTrials()
    } catch { /* ignore */ } finally {
      setUploading(false)
      // Reset input
      e.target.value = ""
    }
  }

  const deleteTrial = (id: string) => setTrials(prev => prev.filter(t => t.id !== id))

  return (
    <div className="min-h-screen bg-rose-50/30">
      <div className="border-b border-rose-100 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/clinic" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 transition-colors font-medium">
            <ChevronLeft className="w-4 h-4" />Back to Map
          </Link>
          <div className="w-px h-5 bg-rose-100" />
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-rose-500" />
            <span className="font-semibold text-gray-900">markovHealth · Trial Portfolio</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchTrials} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
          <label className="cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-colors shadow-sm">
            {uploading ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading..." : "New Trial"}
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Active Clinical Trials</h1>
          <p className="text-gray-400 text-sm">
            {loading ? "Loading..." : trials.length === 0 ? "No active trials yet — upload a trial protocol to get started." : `${trials.length} trial${trials.length !== 1 ? "s" : ""} active · Click any card to view patient roster`}
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Activity className="w-6 h-6 text-rose-400 animate-spin" />
          </div>
        )}

        {!loading && trials.length === 0 && (
          <div className="bg-white border border-dashed border-rose-200 rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Upload className="w-7 h-7 text-rose-300" />
            </div>
            <p className="text-gray-600 font-medium mb-1">No trials uploaded yet</p>
            <p className="text-sm text-gray-400 mb-5">Upload a trial protocol from the clinic dashboard or using the button above.</p>
            <label className="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-colors">
              <Upload className="w-4 h-4" />Upload Protocol
              <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        )}

        <div className="space-y-6">
          <AnimatePresence>
            {trials.map(trial => (
              <TrialCard key={trial.id} trial={trial} onDelete={deleteTrial} />
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
