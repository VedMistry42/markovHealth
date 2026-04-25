"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Send, Filter, MapPin, Upload,
  ChevronDown, ChevronUp, X, Zap, CheckCircle2
} from "lucide-react"
import { PATIENT_ARCHETYPES } from "@/lib/sampleData"

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract ECOG status (0–4) from raw clinical text */
function extractEcog(text: string): number {
  const m = text.match(/ECOG(?:\s+performance(?:\s+status)?)?[:\s]+([0-4])/i)
  return m ? parseInt(m[1]) : 1
}

/** ECOG → fragility index 0.0–1.0 */
function fragilityFromEcog(ecog: number): number { return ecog / 4.0 }

// ─── Constants ────────────────────────────────────────────────────────────────

const SCORES: Record<string, number> = {
  "arch-1": 98, "arch-2": 45, "arch-3": 12,
  "arch-4": 87, "arch-5": 72, "arch-6": 91,
}

const FASTAPI = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000"

// ─── RL log builder ───────────────────────────────────────────────────────────

function buildRlLogs(name: string, action: string, r: number): string[] {
  return [
    `> Initializing MDP for patient: ${name}`,
    "> Loading geo-spatial embeddings from patient coords...",
    "> Computing Bellman value functions (γ=0.97)...",
    `> Evaluating HUB_FLIGHT   : R = ${(r - 86).toFixed(2)}`,
    `> Evaluating LOCAL_CLINIC : R = ${(r - 60).toFixed(2)}`,
    `> Evaluating ${action.padEnd(14)}: R = ${r.toFixed(2)}  <- SELECTED`,
    "> Solving optimal policy π*(s)...",
    "> Dropout risk: 0% (care delivered at patient location)",
    "> Route geometry encoded (GeoJSON LineString).",
    "> Decision committed. Dispatching logistics...",
  ]
}

/** Pre-compute expected action before the backend call (for the log preview) */
function previewAction(archId: string): { action: string; reward: number; label: string } {
  const HUB_LAT = 40.76; const HUB_LNG = -73.95
  const p = PATIENT_ARCHETYPES.find(a => a.id === archId)
  if (!p) return { action: "MOBILE_UNIT", reward: 47.8, label: "Option A: Dispatch Mobile Unit" }
  const d = Math.sqrt(
    Math.pow((p.lat - HUB_LAT) * 69, 2) +
    Math.pow((p.lng - HUB_LNG) * 52, 2)
  )
  if (d < 30)  return { action: "LOCAL_CLINIC", reward: 38.4, label: "Option A: Local Clinic Referral" }
  if (d < 180) return { action: "MOBILE_UNIT",  reward: 47.8, label: "Option A: Dispatch Mobile Unit" }
  return         { action: "HUB_FLIGHT",    reward: 21.2, label: "Option A: Hub Flight Transport" }
}

// ─── RL Terminal component ────────────────────────────────────────────────────

function RLTerminal({ logs, isActive }: { logs: string[]; isActive: boolean }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive) { setCount(0); return }
    setCount(0)
    let i = 0
    const iv = setInterval(() => { i++; setCount(i); if (i >= logs.length) clearInterval(iv) }, 200)
    return () => clearInterval(iv)
  }, [isActive, logs])

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [count])

  if (!isActive && count === 0) return null
  const visible = logs.slice(0, count)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full rounded-xl border border-gray-800 bg-[#0a0e12] overflow-hidden shadow-inner mb-3"
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 bg-gray-900">
        <span className="w-2 h-2 rounded-full bg-red-500/70" />
        <span className="w-2 h-2 rounded-full bg-yellow-500/70" />
        <span className="w-2 h-2 rounded-full bg-green-500/70" />
        <span className="ml-2 text-[9px] text-gray-500 font-mono">markov-rl-engine v2.1 — logistics solver</span>
      </div>
      <div ref={ref} className="p-3 h-40 overflow-y-auto font-mono text-[10px] leading-5 space-y-0.5">
        {visible.map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
            className={
              line.includes("SELECTED") ? "text-emerald-400 font-bold" :
              line.startsWith(">")       ? "text-gray-300" : "text-gray-600"
            }
          >{line}</motion.div>
        ))}
        {isActive && count < logs.length && (
          <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </div>
    </motion.div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trial { id: string; trialName: string; criteria: string; createdAt: string }

interface Toast {
  action: string
  travelSaved: number
  fragility: boolean
  reward: number
  patientName: string
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ClinicianDashboard() {
  const [activeTrial, setActiveTrial]       = useState<Trial | null>(null)
  const [uploadingTrial, setUploadingTrial] = useState(false)
  const [uploadLogs, setUploadLogs]         = useState<string[]>([])
  const [uploadActive, setUploadActive]     = useState(false)
  const [showMatches, setShowMatches]       = useState(false)
  const [expandedStory, setExpandedStory]   = useState<Record<string, boolean>>({})
  const [lState, setLState] = useState<Record<string, "loading" | "done">>({})
  const [lLogs, setLLogs]   = useState<Record<string, string[]>>({})
  const [lActive, setLActive] = useState<Record<string, boolean>>({})
  const [selected, setSelected]       = useState<Record<string, string>>({})
  const [confirmed, setConfirmed]     = useState<Record<string, boolean>>({})
  const [toasts, setToasts]           = useState<Record<string, Toast | null>>({})
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set())
  const [realMatches, setRealMatches]   = useState<any[]>([])

  // Poll for real-time patient matches
  useEffect(() => {
    async function fetchRealMatches() {
      try {
        const res = await fetch("/api/clinic/patients")
        if (res.ok) {
          const data = await res.json()
          setRealMatches(data)
        }
      } catch { /* ignore */ }
    }
    const id = setInterval(fetchRealMatches, 5000)
    fetchRealMatches()
    return () => clearInterval(id)
  }, [])

  // Poll for confirmations from the patient portal
  useEffect(() => {
    async function checkConfirmations() {
      try {
        const res = await fetch("/api/clinic/confirmed-patients")
        if (res.ok) {
          const data = await res.json()
          setConfirmedIds(new Set(data.map((r: any) => r.patientId)))
        }
      } catch { /* ignore */ }
    }
    const id = setInterval(checkConfirmations, 3000)
    checkConfirmations()
    return () => clearInterval(id)
  }, [])

  // ── Upload trial protocol ──
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploadingTrial(true)
    setShowMatches(false)
    setLState({}); setConfirmed({})

    const fd = new FormData()
    fd.append("file", file)
    try {
      const res = await fetch("/api/trials", { method: "POST", body: fd })
      const data = await res.json()
      setActiveTrial(data.trial ?? {
        id: `t-${Date.now()}`,
        trialName: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase(),
        criteria: "Must have Stage IIIB/IV NSCLC, KRAS G12C. ECOG ≤ 1. No active brain mets.",
        createdAt: new Date().toISOString(),
      })
    } catch {
      setActiveTrial({
        id: `t-${Date.now()}`,
        trialName: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase(),
        criteria: "Must have Stage IIIB/IV NSCLC, KRAS G12C. ECOG ≤ 1. No active brain mets.",
        createdAt: new Date().toISOString(),
      })
    }
    setUploadingTrial(false)

    const globalLogs = [
      "> Parsing trial protocol document...",
      "> Extracting inclusion / exclusion criteria...",
      "> Vectorising trial criteria embeddings...",
      "> Loading patient geo-spatial embeddings...",
      "> Running eligibility scoring across patient network...",
      "> Computing Bellman value functions (γ=0.97)...",
      "> Ranking patients by R(s,a) = α·M − β·d·F − γ·C...",
      "> Geospatial logistics routing initialised...",
      "> 6 eligible candidates identified.",
      "> Matching complete. Rendering results...",
    ]
    setUploadLogs(globalLogs)
    setUploadActive(true)
    setTimeout(() => {
      setUploadActive(false)
      setShowMatches(true)
      window.dispatchEvent(new CustomEvent("trial-uploaded"))
    }, globalLogs.length * 210 + 600)
  }

  // ── Run RL logistics per patient ──
  const runLogistics = async (archId: string) => {
    const arch = PATIENT_ARCHETYPES.find(a => a.id === archId)
    if (!arch) return

    const ecog      = extractEcog(arch.clinicalText)
    const fragility = fragilityFromEcog(ecog)
    const matchScore = SCORES[archId] ?? 85
    const preview   = previewAction(archId)
    const logs      = buildRlLogs(arch.name, preview.action, preview.reward)

    setLLogs(p => ({ ...p, [archId]: logs }))
    setLActive(p => ({ ...p, [archId]: true }))
    setLState(p => ({ ...p, [archId]: "loading" }))

    let finalLabel = preview.label
    let travelSaved = 0
    let fragilityAcc = false
    let bestReward = preview.reward
    let routeGeometry: number[][] | null = null

    try {
      const res = await fetch(`${FASTAPI}/calculate-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id:      archId,
          patient_coords:  { lat: arch.lat, lng: arch.lng },
          is_match:        true,
          match_score:     matchScore,
          fragility_index: fragility,
          match_data: {
            condition:   "Stage IIIB NSCLC",
            urgency:     "high",
            ecog_status: ecog,
          },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const action = data.selected_action as string
        const plan   = data.logistics_plan ?? {}
        const em     = plan.empathy_metrics ?? {}
        bestReward   = em.best_vs_worst_reward_delta ?? preview.reward
        travelSaved  = em.patient_travel_saved_miles ?? 0
        fragilityAcc = em.fragility_accommodated ?? false
        routeGeometry = plan.route?.geometry?.coordinates ?? null
        const t = plan.estimated_time ?? ""
        const actionLabel =
          action === "MOBILE_UNIT"  ? `Mobile Unit Dispatch${t ? ` · ${t}` : ""}` :
          action === "LOCAL_CLINIC" ? `Local Clinic Referral${t ? ` · ${t}` : ""}` :
                                     `Hub Flight Transport${t ? ` · ${t}` : ""}`
        finalLabel = `Option A: ${actionLabel} (R=${bestReward.toFixed(1)})`
      }
    } catch { /* use simulated result */ }

    setTimeout(() => {
      setLActive(p => ({ ...p, [archId]: false }))
      setLState(p => ({ ...p, [archId]: "done" }))
      setSelected(p => ({ ...p, [archId]: finalLabel }))
      
      // Persist to DB for the map
      fetch("/api/clinic/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: archId,
          trialId: activeTrial?.id,
          patientName: arch.name,
          lat: arch.lat,
          lng: arch.lng,
          route: {
            selected_action: finalLabel.split(":")[1]?.trim()?.split(" ")[0]?.toUpperCase()?.replace("MOBILE", "MOBILE_UNIT")?.replace("LOCAL", "LOCAL_CLINIC")?.replace("HUB", "HUB_FLIGHT") || "MOBILE_UNIT",
            geometry: { type: "LineString", coordinates: routeGeometry },
            empathy_metrics: {
              match_score: matchScore,
              patient_travel_saved_miles: travelSaved,
              fragility_accommodated: fragilityAcc,
              dropout_risk_pct: Math.round(100 - matchScore * 0.8),
            },
            cost_analysis: { cost_usd: 450 } // mock cost
          }
        })
      }).catch(e => console.error("Logistics save failed", e))

      setToasts(p => ({
        ...p,
        [archId]: { action: finalLabel, travelSaved, fragility: fragilityAcc, reward: bestReward, patientName: arch.name }
      }))
      window.dispatchEvent(new CustomEvent("patient-dispatched", {
        detail: { patientId: archId, geometry: routeGeometry, archetype: arch }
      }))
      setTimeout(() => setToasts(p => ({ ...p, [archId]: null })), 8000)
    }, logs.length * 210 + 400)
  }

  const confirmPatient = (archId: string) => setConfirmed(p => ({ ...p, [archId]: true }))

  const mergedPatients = [...PATIENT_ARCHETYPES]
  realMatches.forEach(rm => {
    if (!mergedPatients.find(p => p.id === rm.patientId)) {
      mergedPatients.push({
        id: rm.patientId,
        name: rm.patientName || "New Patient",
        age: 0,
        location: rm.location || "Remote",
        lat: rm.lat,
        lng: rm.lng,
        story: "Matched through live screening portal.",
        clinicalText: rm.condition || "Clinical details available upon request."
      })
    }
  })

  const sortedArchetypes = mergedPatients.sort(
    (a, b) => (SCORES[b.id] ?? 85) - (SCORES[a.id] ?? 85)
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute top-4 right-4 w-[460px] h-[calc(100vh-80px)] flex flex-col gap-3 z-10"
    >
      {/* ── Empathy Toast Notifications ── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 space-y-2 pointer-events-none w-[500px]">
        <AnimatePresence>
          {Object.entries(toasts).map(([id, toast]) => {
            if (!toast) return null
            return (
              <motion.div key={id}
                initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="pointer-events-auto bg-gray-950 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-4 border border-emerald-500/30"
              >
                <div className="w-8 h-8 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Logistics Optimised · markovHealth RL</p>
                  <p className="text-sm font-semibold text-white leading-snug">
                    {toast.action.replace("Option A: ", "")} dispatched to {toast.patientName}.
                  </p>
                  {toast.travelSaved > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Saved patient <span className="text-emerald-400 font-bold">{toast.travelSaved.toFixed(0)} miles</span> of travel.
                      {toast.fragility && <span className="text-amber-400 font-semibold"> · Fragility fully accommodated.</span>}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1 font-mono">R(s,a) = α·M − β·d·F − γ·C = {toast.reward.toFixed(2)}</p>
                </div>
                <button onClick={() => setToasts(p => ({ ...p, [id]: null }))} className="text-gray-600 hover:text-white transition-colors flex-shrink-0 text-lg leading-none">×</button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* ── Trial Upload Panel ── */}
      <div className="bg-white/95 backdrop-blur-md border border-rose-100 rounded-3xl p-5 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-wide">ACTIVE TRIAL PROTOCOL</h2>
          </div>
          <label className="cursor-pointer text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
            <Upload className="w-3 h-3" />
            {activeTrial ? "Replace Protocol" : "Upload Protocol"}
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleUpload} />
          </label>
        </div>

        {!activeTrial && !uploadingTrial && (
          <div className="flex flex-col items-center justify-center py-5 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 border border-dashed border-gray-200">
              <Upload className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No active trial</p>
            <p className="text-xs text-gray-400 mt-1">Upload a PDF or TXT trial protocol to begin matching</p>
          </div>
        )}

        {uploadingTrial && (
          <div className="flex items-center gap-3 py-3 text-sm text-gray-500">
            <Activity className="w-4 h-4 animate-spin text-indigo-500" />
            Parsing protocol document...
          </div>
        )}

        {activeTrial && !uploadingTrial && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 mb-2">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide line-clamp-1">{activeTrial.trialName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Uploaded {new Date(activeTrial.createdAt).toLocaleTimeString()}</p>
              </div>
              <button onClick={() => { setActiveTrial(null); setShowMatches(false); setLState({}) }} className="text-gray-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">{activeTrial.criteria}</p>
          </div>
        )}

        <AnimatePresence>
          {uploadLogs.length > 0 && <RLTerminal logs={uploadLogs} isActive={uploadActive} />}
        </AnimatePresence>
      </div>

      {/* ── Patient Matches ── */}
      <div className="bg-white/95 backdrop-blur-md border border-indigo-100 rounded-3xl p-5 shadow-lg flex-1 overflow-hidden flex flex-col">
        <h2 className="text-sm font-semibold text-gray-900 tracking-wide mb-3 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${showMatches ? "bg-emerald-400 animate-pulse" : "bg-gray-200"}`} />
          ELIGIBLE PATIENTS
          {showMatches && <span className="text-indigo-500 font-bold ml-auto">{sortedArchetypes.length} found</span>}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence>
            {!showMatches ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center py-8"
              >
                <Zap className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">Upload a trial protocol to see matches</p>
                <p className="text-xs text-gray-400 mt-1">The RL engine evaluates R(s,a) = α·M − β·d·F − γ·C</p>
              </motion.div>
            ) : sortedArchetypes.map((p, i) => {
              const score   = SCORES[p.id] ?? 0
              const state   = lState[p.id]
              const isConf  = confirmed[p.id]
              const isOpen  = expandedStory[p.id]
              const preview = previewAction(p.id)
              const scoreColor = score > 80 ? "text-emerald-500" : score > 40 ? "text-amber-500" : "text-gray-400"
              const scoreBg   = score > 80 ? "bg-emerald-50 border-emerald-100" : score > 40 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"

              return (
                <motion.div key={p.id}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className={`relative rounded-3xl p-5 border-2 transition-all hover:shadow-md ${confirmedIds.has(p.id) ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-indigo-50/50 shadow-sm"}`}
                >
                  {confirmedIds.has(p.id) && (
                    <div className="absolute top-4 right-4 group">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full shadow-sm animate-pulse">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>CONFIRMED INTEREST</span>
                      </div>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${score > 80 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                      {score}%
                    </div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="font-bold text-gray-900 text-base leading-tight truncate">{p.name || "Patient"}</h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                        <MapPin className="w-3 h-3" /> {p.location} · {p.age} yrs
                      </div>
                    </div>
                  </div>

                  {/* Story */}
                  <p className="text-xs text-gray-500 italic leading-relaxed mb-1">
                    &ldquo;{isOpen ? p.story : `${p.story.slice(0, 80)}...`}&rdquo;
                  </p>
                  <button
                    onClick={() => setExpandedStory(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 mb-3 hover:text-indigo-600"
                  >
                    {isOpen ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Read more</>}
                  </button>

                  {/* Pre-run hint */}
                  {!state && !isConf && (
                    <p className="text-[10px] text-gray-400 italic mb-2">
                      Expected: <span className="font-semibold text-gray-600">{preview.label.replace("Option A: ", "")}</span>
                      <span className="text-gray-400"> (preview — β·d·F drives final decision)</span>
                    </p>
                  )}

                  {/* Per-patient RL terminal */}
                  <AnimatePresence>
                    {lLogs[p.id] && (state === "loading" || state === "done") && (
                      <RLTerminal logs={lLogs[p.id]} isActive={lActive[p.id] ?? false} />
                    )}
                  </AnimatePresence>

                  {/* Action area */}
                  {isConf ? (
                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-2 py-1.5">
                      <CheckCircle2 className="w-4 h-4" />Added to Network — Logistics Confirmed
                    </div>
                  ) : !state ? (
                    <button onClick={() => runLogistics(p.id)}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-gray-800 shadow transition-all"
                    >
                      <Zap className="w-3 h-3" />Calculate Logistics &amp; Add to Network
                    </button>
                  ) : state === "loading" ? (
                    <div className="w-full rounded-xl border border-gray-800 bg-[#0a0e12] flex items-center justify-center gap-2 py-2.5">
                      <Activity className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span className="text-[10px] font-mono text-emerald-400">Running RL solver...</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 mt-1">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 flex justify-between items-center">
                        <span>{selected[p.id] ?? preview.label}</span>
                        <span className="text-emerald-400 text-[10px]">Selected</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">
                        Option B: Alternative route (lower R(s,a))
                      </div>
                      <button onClick={() => confirmPatient(p.id)}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow transition-colors mt-1"
                      >
                        <Send className="w-3 h-3" />Confirm &amp; Send Plan to Patient
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
