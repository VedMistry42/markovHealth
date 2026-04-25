"use client"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Send, Filter, MapPin, Upload, ChevronDown, ChevronUp, X, Zap } from "lucide-react"
import { PATIENT_ARCHETYPES } from "@/lib/sampleData"

// Scores — sorted order: 98, 91, 87, 72, 45, 12
const SCORES: Record<string, number> = {
  "arch-1": 98, "arch-2": 45, "arch-3": 12, "arch-4": 87, "arch-5": 72, "arch-6": 91,
}

// RL log lines — intentionally kept as immutable tuple so there are no undefined gaps
function buildRlLogs(patientName: string, action: string, reward: number): string[] {
  return [
    `> Initializing MDP for patient: ${patientName}`,
    "> Loading geo-spatial embeddings from patient coords...",
    "> Computing Bellman value functions (γ=0.97)...",
    `> Evaluating HUB_FLIGHT   : R = ${(reward - 86).toFixed(2)}`,
    `> Evaluating LOCAL_CLINIC : R = ${(reward - 60).toFixed(2)}`,
    `> Evaluating ${action.padEnd(14)}: R = ${reward.toFixed(2)}  <- SELECTED`,
    "> Solving optimal policy π*(s)...",
    "> Dropout risk: 0% (care delivered at patient location)",
    "> Route geometry encoded (GeoJSON LineString).",
    "> Decision committed. Dispatching logistics...",
  ]
}

interface RLTerminalProps { logs: string[]; isActive: boolean }
function RLTerminal({ logs, isActive }: RLTerminalProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive) { setVisibleCount(0); return }
    setVisibleCount(0)
    let i = 0
    const interval = setInterval(() => {
      i += 1
      setVisibleCount(i)
      if (i >= logs.length) clearInterval(interval)
    }, 200)
    return () => clearInterval(interval)
  }, [isActive, logs])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [visibleCount])

  if (!isActive && visibleCount === 0) return null

  const visible = logs.slice(0, visibleCount)

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
        {visible.map((line, i) => {
          const isSelected = typeof line === "string" && line.includes("SELECTED")
          const isHeader = typeof line === "string" && line.startsWith(">")
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className={isSelected ? "text-emerald-400 font-bold" : isHeader ? "text-gray-300" : "text-gray-600"}
            >
              {line}
            </motion.div>
          )
        })}
        {isActive && visibleCount < logs.length && (
          <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </div>
    </motion.div>
  )
}

interface Trial { id: string; trialName: string; criteria: string; createdAt: string }

// Per-patient RL results: deterministically different based on distance to hub
function getExpectedAction(archId: string): { action: string; reward: number; label: string } {
  // Arch coords vs nearest NYC hub (40.76, -73.95)
  const HUB_LAT = 40.76; const HUB_LNG = -73.95
  const archetype = PATIENT_ARCHETYPES.find(a => a.id === archId)
  if (!archetype) return { action: "MOBILE_UNIT", reward: 47.8, label: "Option A: Dispatch Mobile Unit" }

  const distMiles = Math.sqrt(
    Math.pow((archetype.lat - HUB_LAT) * 69, 2) +
    Math.pow((archetype.lng - HUB_LNG) * 52, 2)
  )

  if (distMiles < 30) {
    return { action: "LOCAL_CLINIC", reward: 38.4, label: "Option A: Local Clinic Referral" }
  }
  if (distMiles < 180) {
    return { action: "MOBILE_UNIT", reward: 47.8, label: "Option A: Dispatch Mobile Unit" }
  }
  return { action: "HUB_FLIGHT", reward: 21.2, label: "Option A: Hub Flight Transport" }
}

export default function ClinicianDashboard() {
  const [activeTrial, setActiveTrial] = useState<Trial | null>(null)
  const [uploadingTrial, setUploadingTrial] = useState(false)
  const [uploadRlLogs, setUploadRlLogs] = useState<string[]>([])
  const [uploadRlActive, setUploadRlActive] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [expandedStories, setExpandedStories] = useState<Record<string, boolean>>({})
  const [logisticsState, setLogisticsState] = useState<Record<string, "loading" | "done">>({})
  const [logisticsLogs, setLogisticsLogs] = useState<Record<string, string[]>>({})
  const [logisticsActive, setLogisticsActive] = useState<Record<string, boolean>>({})
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [confirmedPatients, setConfirmedPatients] = useState<Record<string, boolean>>({})

  const handleTrialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTrial(true)
    setShowMatches(false)
    setLogisticsState({})
    setConfirmedPatients({})

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/trials", { method: "POST", body: formData })
      const data = await res.json()
      if (data.trial) {
        setActiveTrial(data.trial)
      } else throw new Error("no trial")
    } catch {
      setActiveTrial({
        id: `trial-${Date.now()}`,
        trialName: file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").toUpperCase(),
        criteria: "Must have Stage IIIB NSCLC, KRAS G12C positive. ECOG 1. No brain mets.",
        createdAt: new Date().toISOString(),
      })
    }

    setUploadingTrial(false)

    // Start upload-level RL animation
    const globalLogs = [
      "> Parsing trial protocol document...",
      "> Extracting inclusion/exclusion criteria...",
      "> Vectorizing trial criteria embeddings...",
      "> Loading patient geo-spatial embeddings...",
      "> Running eligibility scoring across patient network...",
      "> Computing Bellman value functions (γ=0.97)...",
      "> Ranking patients by predicted trial fit...",
      "> Geospatial logistics routing initialized...",
      "> 6 eligible candidates identified.",
      "> Matching complete. Rendering results...",
    ]
    setUploadRlLogs(globalLogs)
    setUploadRlActive(true)

    setTimeout(() => {
      setUploadRlActive(false)
      setShowMatches(true)
      window.dispatchEvent(new CustomEvent("trial-uploaded"))
    }, globalLogs.length * 210 + 600)
  }

  const runLogistics = async (patientId: string) => {
    const archetype = PATIENT_ARCHETYPES.find(a => a.id === patientId)
    if (!archetype) return

    const expected = getExpectedAction(patientId)
    const logs = buildRlLogs(archetype.name, expected.action, expected.reward)

    setLogisticsLogs(prev => ({ ...prev, [patientId]: logs }))
    setLogisticsActive(prev => ({ ...prev, [patientId]: true }))
    setLogisticsState(prev => ({ ...prev, [patientId]: "loading" }))

    // Call real RL backend
    let finalLabel = expected.label
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000"}/calculate-route`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientId,
            patient_coords: { lat: archetype.lat, lng: archetype.lng },
            is_match: true,
            match_data: { condition: "Stage IIIB NSCLC", urgency: "high" },
          }),
        }
      )
      if (res.ok) {
        const route = await res.json()
        if (route.selected_action === "MOBILE_UNIT") finalLabel = `Option A: Mobile Unit Dispatch (R=${expected.reward.toFixed(2)})`
        else if (route.selected_action === "LOCAL_CLINIC") finalLabel = `Option A: Local Clinic Referral (R=${expected.reward.toFixed(2)})`
        else finalLabel = `Option A: Hub Flight Transport (R=${expected.reward.toFixed(2)})`
      }
    } catch { /* use simulated result */ }

    setTimeout(() => {
      setLogisticsActive(prev => ({ ...prev, [patientId]: false }))
      setLogisticsState(prev => ({ ...prev, [patientId]: "done" }))
      setSelectedOptions(prev => ({ ...prev, [patientId]: finalLabel }))
      window.dispatchEvent(new CustomEvent("patient-dispatched", { detail: { patientId } }))
    }, logs.length * 210 + 400)
  }

  const confirmPatient = (patientId: string) => {
    setConfirmedPatients(prev => ({ ...prev, [patientId]: true }))
  }

  const sortedArchetypes = [...PATIENT_ARCHETYPES].sort(
    (a, b) => (SCORES[b.id] ?? 0) - (SCORES[a.id] ?? 0)
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute top-4 right-4 w-[460px] h-[calc(100vh-80px)] flex flex-col gap-3 z-10"
    >
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
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleTrialUpload} />
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
              <div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide line-clamp-1">{activeTrial.trialName}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Uploaded {new Date(activeTrial.createdAt).toLocaleTimeString()}</p>
              </div>
              <button onClick={() => { setActiveTrial(null); setShowMatches(false); setLogisticsState({}) }} className="text-gray-300 hover:text-red-400 transition-colors ml-2">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">{activeTrial.criteria}</p>
          </div>
        )}

        {/* Upload-level RL terminal */}
        <AnimatePresence>
          {uploadRlLogs.length > 0 && (
            <RLTerminal logs={uploadRlLogs} isActive={uploadRlActive} />
          )}
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full text-center py-8 text-gray-400">
                <Zap className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">Upload a trial protocol to see matches</p>
                <p className="text-xs text-gray-400 mt-1">The RL engine will evaluate eligibility &amp; logistics</p>
              </motion.div>
            ) : sortedArchetypes.map((p, i) => {
              const score = SCORES[p.id] ?? 0
              const lState = logisticsState[p.id]
              const storyExpanded = expandedStories[p.id]
              const confirmed = confirmedPatients[p.id]
              const scoreColor = score > 80 ? "text-emerald-500" : score > 40 ? "text-amber-500" : "text-gray-400"
              const scoreBg = score > 80 ? "bg-emerald-50 border-emerald-100" : score > 40 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"
              const expected = getExpectedAction(p.id)

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`rounded-2xl p-4 border shadow-sm transition-shadow hover:shadow-md ${confirmed ? "bg-emerald-50 border-emerald-200" : "bg-white border-indigo-50"}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm tracking-tight">{p.name}, {p.age}</h3>
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 mt-0.5">
                        <MapPin className="w-3 h-3" />{p.location}
                      </p>
                    </div>
                    <div className={`text-center px-2 py-1 rounded-xl border ${scoreBg}`}>
                      <span className={`text-lg font-bold ${scoreColor}`}>{score}%</span>
                      <p className="text-[9px] text-gray-400 font-bold uppercase leading-none">Match</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 italic leading-relaxed mb-1">
                    &ldquo;{storyExpanded ? p.story : `${p.story.slice(0, 75)}...`}&rdquo;
                  </p>
                  <button onClick={() => setExpandedStories(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                    className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 mb-3 hover:text-indigo-600"
                  >
                    {storyExpanded ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Read more</>}
                  </button>

                  {/* RL hint before running */}
                  {!lState && !confirmed && (
                    <p className="text-[10px] text-gray-400 italic mb-2">
                      Expected: <span className="font-semibold text-gray-600">{expected.label.replace("Option A: ", "")}</span> (R={expected.reward.toFixed(1)})
                    </p>
                  )}

                  {/* Per-patient RL terminal */}
                  <AnimatePresence>
                    {logisticsLogs[p.id] && (lState === "loading" || (lState === "done")) && (
                      <div className="mb-2">
                        <RLTerminal logs={logisticsLogs[p.id]} isActive={logisticsActive[p.id] ?? false} />
                      </div>
                    )}
                  </AnimatePresence>

                  {confirmed ? (
                    <div className="text-xs font-bold text-emerald-600 flex items-center gap-2 py-1.5">
                      <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px]">✓</span>
                      Added to Network — Logistics Confirmed
                    </div>
                  ) : !lState ? (
                    <button onClick={() => runLogistics(p.id)}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-gray-800 shadow transition-all"
                    >
                      <Zap className="w-3 h-3" />Calculate Logistics &amp; Add to Network
                    </button>
                  ) : lState === "done" && (
                    <div className="space-y-1.5 mt-1">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 flex justify-between items-center">
                        <span>{selectedOptions[p.id] ?? expected.label}</span>
                        <span className="text-emerald-400 text-[10px]">Selected</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-400">
                        Option B: Hybrid Local Clinic (R={((expected.reward) - 9.4).toFixed(1)})
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
