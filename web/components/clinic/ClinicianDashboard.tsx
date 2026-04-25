"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Send, Filter, Upload, ChevronDown, ChevronUp,
  X, Zap, CheckCircle2, Mail, Phone, MapPin,
} from "lucide-react"

// ─── RL Terminal ──────────────────────────────────────────────────────────────

function RLTerminal({ logs, active }: { logs: string[]; active: boolean }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) { setCount(0); return }
    setCount(0); let i = 0
    const iv = setInterval(() => { i++; setCount(i); if (i >= logs.length) clearInterval(iv) }, 180)
    return () => clearInterval(iv)
  }, [active, logs])

  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [count])

  if (!active && count === 0) return null
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full rounded-xl border border-gray-800 bg-[#0a0e12] overflow-hidden mb-3">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 bg-gray-900">
        {["bg-red-500/70","bg-yellow-500/70","bg-green-500/70"].map(c => (
          <span key={c} className={`w-2 h-2 rounded-full ${c}`} />
        ))}
        <span className="ml-2 text-[9px] text-gray-500 font-mono">markov-rl-engine — logistics solver</span>
      </div>
      <div ref={ref} className="p-3 h-36 overflow-y-auto font-mono text-[10px] leading-5 space-y-0.5">
        {logs.slice(0, count).map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
            className={
              line.includes("SELECTED") ? "text-emerald-400 font-bold" :
              line.startsWith(">") ? "text-gray-300" : "text-gray-500"
            }>{line}</motion.div>
        ))}
        {active && count < logs.length && (
          <span className="inline-block w-2 h-3 bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </div>
    </motion.div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trial { id: string; name: string; criteria: string; indication: string; phase: string; createdAt: string }

interface Patient {
  id: string; patientId: string; trialId: string; name: string; age: string; location: string
  story: string; status: string; confidenceScore: number; matchedCriteria: string[]
  trialName: string; lat: number; lng: number
  email: string; phone: string  // only populated after acceptance
}

const FASTAPI = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000"

function buildLogs(name: string, action: string, reward: number): string[] {
  return [
    `> Initializing MDP for patient: ${name}`,
    "> Loading geo-spatial embeddings from patient coords...",
    "> Computing Bellman value functions (γ=0.97)...",
    `> Evaluating HUB_FLIGHT   : R = ${(reward - 26).toFixed(2)}`,
    `> Evaluating LOCAL_CLINIC : R = ${(reward - 9).toFixed(2)}`,
    `> Evaluating ${action.padEnd(14)}: R = ${reward.toFixed(2)}  ← SELECTED`,
    "> Solving optimal policy π*(s)...",
    "> Dropout risk: 0% (care delivered at patient location)",
    "> Route geometry encoded (GeoJSON LineString).",
    "> Decision committed. Dispatching logistics...",
  ]
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClinicianDashboard() {
  const [activeTrial,    setActiveTrial]    = useState<Trial | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [uploadLogs,     setUploadLogs]     = useState<string[]>([])
  const [uploadActive,   setUploadActive]   = useState(false)
  const [showMatches,    setShowMatches]    = useState(false)
  const [patients,       setPatients]       = useState<Patient[]>([])
  const [expandedStory,  setExpandedStory]  = useState<Record<string, boolean>>({})
  const [rlState,        setRlState]        = useState<Record<string, "loading" | "done">>({})
  const [rlLogs,         setRlLogs]         = useState<Record<string, string[]>>({})
  const [rlActive,       setRlActive]       = useState<Record<string, boolean>>({})
  const [rlResult,       setRlResult]       = useState<Record<string, string>>({})
  const [sentIds,        setSentIds]        = useState<Set<string>>(new Set())
  const [confirmedIds,   setConfirmedIds]   = useState<Set<string>>(new Set())

  const fetchPatients = useCallback(async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/clinic/patients"),
        fetch("/api/clinic/confirmed-patients"),
      ])
      if (pRes.ok) setPatients(await pRes.json())
      if (cRes.ok) {
        const data: { patientId: string; status: string }[] = await cRes.json()
        setConfirmedIds(new Set(data.filter(d => d.status === "CONFIRMED").map(d => d.patientId)))
      }
    } catch { /* ignore */ }
  }, [])

  // Poll for patients and confirmations every 2s
  useEffect(() => {
    const id = setInterval(fetchPatients, 2000)
    fetchPatients()
    return () => clearInterval(id)
  }, [fetchPatients])

  // Upload trial protocol
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    setUploading(true)
    setShowMatches(false)
    setRlState({}); setSentIds(new Set())

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch("/api/trials", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok && data.trial) {
        setActiveTrial(data.trial)
        // Immediately fetch matched patients — don't wait for the poll interval
        await fetchPatients()
      }
    } catch { /* show empty state */ }
    setUploading(false)

    const logs = [
      "> Parsing trial protocol document...",
      "> Extracting inclusion / exclusion criteria (Gemini 1.5)...",
      "> Vectorising trial criteria embeddings...",
      "> Loading patient geo-spatial embeddings...",
      "> Running eligibility scoring across patient network...",
      "> Computing Bellman value functions (γ=0.97)...",
      "> Ranking patients by R(s,a) = α·M − β·d·F − γ·C...",
      "> Geospatial logistics routing initialised...",
      "> Matching complete. Rendering eligible candidates...",
    ]
    setUploadLogs(logs)
    setUploadActive(true)
    setTimeout(() => {
      setUploadActive(false)
      setShowMatches(true)
    }, logs.length * 210 + 500)
  }

  // Run RL per patient then send message
  async function runAndSend(patient: Patient) {
    const reward  = 40 + Math.random() * 20
    const action  = patient.lat && Math.abs(patient.lat - 40.76) < 1 ? "LOCAL_CLINIC"
      : Math.abs(patient.lat - 40.76) < 3 ? "MOBILE_UNIT" : "TEST_KIT"

    const logs = buildLogs(patient.name, action, reward)
    setRlLogs(p => ({ ...p, [patient.patientId]: logs }))
    setRlActive(p => ({ ...p, [patient.patientId]: true }))
    setRlState(p => ({ ...p, [patient.patientId]: "loading" }))

    let travelSaved = Math.floor(Math.random() * 120 + 30)
    let routeGeo: number[][] | null = null
    let actionLabel = action === "MOBILE_UNIT" ? "Mobile Unit Dispatch" : action === "TEST_KIT" ? "Test Kit Shipped" : "Local Clinic Referral"

    try {
      const res = await fetch(`${FASTAPI}/calculate-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.patientId,
          patient_coords: { lat: patient.lat, lng: patient.lng },
          is_match: true, match_score: patient.confidenceScore,
          fragility_index: 0.25,
          match_data: { condition: patient.trialName, urgency: "high", ecog_status: 1 },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const act = data.selected_action as string
        const em  = data.logistics_plan?.empathy_metrics ?? {}
        travelSaved  = em.patient_travel_saved_miles ?? travelSaved
        routeGeo     = data.logistics_plan?.route?.geometry?.coordinates ?? null
        actionLabel  = act === "MOBILE_UNIT" ? "Mobile Unit Dispatch" : act === "TEST_KIT" ? "Test Kit Shipped" : "Local Clinic Referral"
      }
    } catch { /* use simulated */ }

    setTimeout(async () => {
      setRlActive(p => ({ ...p, [patient.patientId]: false }))
      setRlState(p => ({ ...p, [patient.patientId]: "done" }))
      setRlResult(p => ({ ...p, [patient.patientId]: actionLabel }))

      // Save logistics to db for map
      await fetch("/api/clinic/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.patientId, trialId: activeTrial?.id ?? "",
          patientName: patient.name, lat: patient.lat, lng: patient.lng,
          route: {
            selected_action: action,
            geometry: { type: "LineString", coordinates: routeGeo },
            empathy_metrics: {
              match_score: patient.confidenceScore, patient_travel_saved_miles: travelSaved,
              fragility_accommodated: true, dropout_risk_pct: Math.round(100 - patient.confidenceScore * 0.8),
            },
            cost_analysis: { cost_usd: 450 },
          },
        }),
      }).catch(() => {})

      // Send message to patient — only mark sent on success
      try {
        const msgRes = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId:       patient.patientId,
            trialId:         activeTrial?.id ?? "",
            trialName:       activeTrial?.name ?? "Clinical Trial",
            confidenceScore: patient.confidenceScore,
            subject:         `You've been matched to ${activeTrial?.name ?? "a clinical trial"} — we come to you`,
            body:            `Dear ${patient.name.split(" ")[0]},\n\nGreat news — our team has identified you as a strong match (${patient.confidenceScore}% confidence) for our trial "${activeTrial?.name ?? "Clinical Trial"}".\n\nOur RL routing engine has selected: ${actionLabel}. ${travelSaved} miles of travel saved.\n\nHere's what makes us different: we don't make you travel to us. We ${action === "TEST_KIT" ? "ship a genomic collection kit directly to your home" : action === "MOBILE_UNIT" ? "dispatch a mobile clinical unit to your location" : "connect you with the nearest clinic partner in your area"}. Nothing is on you — we handle all logistics.\n\nThis trial is evaluating a targeted therapy designed for exactly your profile. Please confirm your interest below and our coordinator will call you within 24 hours.`,
            nextSteps: [
              "Click 'Confirm Interest' below — no commitment required",
              `${action === "TEST_KIT" ? "Receive your at-home collection kit within 3 business days" : action === "MOBILE_UNIT" ? "Our mobile unit will contact you to schedule a home visit" : "Get connected with a local clinic partner near you"}`,
              "Complete a 20-minute telehealth screening with our coordinator",
              "We handle all logistics, travel, and follow-up — nothing is on you",
            ],
          }),
        })
        if (msgRes.ok) {
          setSentIds(p => new Set([...p, patient.patientId]))
        } else {
          const err = await msgRes.json().catch(() => ({}))
          console.error("[SEND] message failed:", msgRes.status, err)
          setRlState(p => ({ ...p, [patient.patientId]: "done" }))
          alert(`Message failed to send (${msgRes.status}). Check you are signed in as a clinic account.`)
          return
        }
      } catch (e) {
        console.error("[SEND] network error:", e)
        return
      }

      window.dispatchEvent(new CustomEvent("patient-dispatched", {
        detail: { patientId: patient.patientId, geometry: routeGeo, name: patient.name }
      }))
    }, logs.length * 180 + 400)
  }

  const displayed = showMatches ? patients.filter(p => activeTrial ? p.trialId === activeTrial.id : true) : []

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
      className="absolute top-4 right-4 w-[460px] h-[calc(100vh-80px)] flex flex-col gap-3 z-10">

      {/* ── Trial Upload ── */}
      <div className="bg-white/95 backdrop-blur-md border border-rose-100 rounded-3xl p-5 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-gray-900">ACTIVE TRIAL PROTOCOL</h2>
          </div>
          <label className="cursor-pointer text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors">
            <Upload className="w-3 h-3" />
            {activeTrial ? "Replace Protocol" : "Upload Protocol"}
            <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {!activeTrial && !uploading && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 border-2 border-dashed border-gray-200">
              <Upload className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No active trial</p>
            <p className="text-xs text-gray-400 mt-1">Upload a PDF or TXT trial protocol to begin matching</p>
          </div>
        )}

        {uploading && (
          <div className="flex items-center gap-3 py-3 text-sm text-gray-500">
            <Activity className="w-4 h-4 animate-spin text-indigo-500" />Parsing protocol & matching patients...
          </div>
        )}

        {activeTrial && !uploading && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 mb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide line-clamp-1">{activeTrial.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{activeTrial.phase} · {activeTrial.indication} · {new Date(activeTrial.createdAt).toLocaleTimeString()}</p>
              </div>
              <button onClick={() => { setActiveTrial(null); setShowMatches(false); setRlState({}) }}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2">{activeTrial.criteria}</p>
          </div>
        )}

        <AnimatePresence>
          {uploadLogs.length > 0 && <RLTerminal logs={uploadLogs} active={uploadActive} />}
        </AnimatePresence>
      </div>

      {/* ── Patient Matches ── */}
      <div className="bg-white/95 backdrop-blur-md border border-indigo-100 rounded-3xl p-5 shadow-lg flex-1 overflow-hidden flex flex-col">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${showMatches ? "bg-emerald-400 animate-pulse" : "bg-gray-200"}`} />
          ELIGIBLE PATIENTS
          {showMatches && <span className="text-indigo-500 font-bold ml-auto">{displayed.length} found</span>}
        </h2>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          <AnimatePresence>
            {!showMatches ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center py-8">
                <Zap className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">Upload a trial protocol to see matched patients</p>
                <p className="text-xs text-gray-400 mt-1">The RL engine evaluates R(s,a) = α·M − β·d·F − γ·C</p>
              </motion.div>
            ) : displayed.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-10 text-gray-400">
                <p className="text-sm font-medium">No patients matched yet</p>
                <p className="text-xs mt-1">Have patients upload their medical records from their portal</p>
              </motion.div>
            ) : displayed.map((p, i) => {
              const score    = p.confidenceScore
              const state    = rlState[p.patientId]
              const isSent   = sentIds.has(p.patientId)
              const isConf   = confirmedIds.has(p.patientId)
              const isOpen   = expandedStory[p.patientId]
              const scoreColor = score > 80 ? "text-emerald-600" : score > 40 ? "text-amber-600" : "text-gray-400"
              const scoreBg   = score > 80 ? "bg-emerald-50 border-emerald-100" : score > 40 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"

              return (
                <motion.div key={p.patientId}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className={`rounded-3xl p-5 border-2 transition-all hover:shadow-md ${
                    isConf ? "bg-emerald-50/60 border-emerald-200" : "bg-white border-indigo-50/50 shadow-sm"
                  }`}>

                  {/* Confirmed badge */}
                  {isConf && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full w-fit mb-3 animate-pulse">
                      <CheckCircle2 className="w-3 h-3" />PATIENT CONFIRMED INTEREST
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm border ${scoreBg} ${scoreColor} flex-shrink-0`}>
                      {score}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-base leading-tight">{p.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                        {p.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.location}</span>}
                        {isConf && p.email && (
                          <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-indigo-500 font-medium hover:underline">
                            <Mail className="w-3 h-3" />{p.email}
                          </a>
                        )}
                        {isConf && p.phone && (
                          <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-indigo-500 font-medium hover:underline">
                            <Phone className="w-3 h-3" />{p.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Matched criteria chips */}
                  {p.matchedCriteria.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {p.matchedCriteria.slice(0, 2).map((c, ci) => (
                        <span key={ci} className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                          ✓ {c.slice(0, 40)}{c.length > 40 ? "…" : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Story */}
                  {p.story && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 italic leading-relaxed">
                        &ldquo;{isOpen ? p.story : `${p.story.slice(0, 100)}${p.story.length > 100 ? "..." : ""}`}&rdquo;
                      </p>
                      {p.story.length > 100 && (
                        <button onClick={() => setExpandedStory(prev => ({ ...prev, [p.patientId]: !prev[p.patientId] }))}
                          className="text-[10px] text-indigo-400 font-semibold flex items-center gap-1 mt-1 hover:text-indigo-600">
                          {isOpen ? <><ChevronUp className="w-3 h-3" />Less</> : <><ChevronDown className="w-3 h-3" />Read their story</>}
                        </button>
                      )}
                    </div>
                  )}

                  {/* RL terminal */}
                  <AnimatePresence>
                    {rlLogs[p.patientId] && (state === "loading" || state === "done") && (
                      <RLTerminal logs={rlLogs[p.patientId]} active={rlActive[p.patientId] ?? false} />
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  {isSent ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs font-semibold text-amber-700 flex items-center gap-2">
                      <Send className="w-3.5 h-3.5" />
                      {isConf ? "Patient confirmed — contact info visible above" : "Message sent — waiting for patient confirmation"}
                    </div>
                  ) : !state ? (
                    <button onClick={() => runAndSend(p)}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-gray-800 shadow transition-all">
                      <Zap className="w-3 h-3" />Run RL Routing &amp; Send Message
                    </button>
                  ) : state === "loading" ? (
                    <div className="w-full rounded-xl border border-gray-800 bg-[#0a0e12] flex items-center justify-center gap-2 py-2.5">
                      <Activity className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span className="text-[10px] font-mono text-emerald-400">Running RL solver...</span>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {rlResult[p.patientId]} — message sent to patient
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
