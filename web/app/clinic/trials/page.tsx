"use client"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Users, TrendingUp, Clock, ChevronLeft, CheckCircle2,
  Upload, X, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react"
import Link from "next/link"

interface TrialSummary {
  id: string
  name: string
  indication: string
  phase: string
  criteria: string
  researcherName: string
  researcherOrg: string
  researcherEmail: string
  createdAt: string
  enrolled: number
  contacted: number
  pending: number
  total: number
}

function EnrollmentBar({ count, total }: { count: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, Math.round((count / total) * 100))
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{count} contacted / enrolled</span>
        <span>{total} matched</span>
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

function TrialCard({ trial, onDelete }: { trial: TrialSummary; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-rose-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">{trial.phase}</span>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-100">Enrolling</span>
              <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">{trial.indication}</span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />{new Date(trial.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug mb-1">{trial.name}</h2>
            <p className="text-xs text-gray-400">
              <span className="font-medium text-gray-600">{trial.researcherName}</span>
              {trial.researcherOrg && <> · {trial.researcherOrg}</>}
              {trial.researcherEmail && <> · <a href={`mailto:${trial.researcherEmail}`} className="text-indigo-500 hover:underline">{trial.researcherEmail}</a></>}
            </p>
          </div>
          <button onClick={() => onDelete(trial.id)} className="text-gray-200 hover:text-red-400 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-rose-50 rounded-2xl p-3 text-center border border-rose-100">
            <Users className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{trial.total}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Matched</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
            <TrendingUp className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{trial.contacted}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Contacted</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{trial.enrolled}</p>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Confirmed</p>
          </div>
        </div>

        <EnrollmentBar count={trial.contacted + trial.enrolled} total={trial.total} />

        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors"
        >
          {expanded ? <><ChevronUp className="w-3.5 h-3.5" />Hide Criteria</> : <><ChevronDown className="w-3.5 h-3.5" />View Trial Criteria</>}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-rose-50"
          >
            <div className="p-4 bg-gray-50/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Eligibility Criteria</p>
              <p className="text-xs text-gray-600 leading-relaxed">{trial.criteria}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function TrialStatusPage() {
  const [trials, setTrials] = useState<TrialSummary[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchTrials = useCallback(async () => {
    try {
      const res = await fetch("/api/trials")
      if (!res.ok) return
      const data = await res.json()
      setTrials(Array.isArray(data) ? data : [])
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
            {loading ? "Loading..." : trials.length === 0
              ? "No active trials yet — upload a trial protocol to get started."
              : `${trials.length} trial${trials.length !== 1 ? "s" : ""} active`}
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
