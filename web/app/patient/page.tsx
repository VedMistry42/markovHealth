"use client"
import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, LogOut, Shield, Heart, MessageSquare, FileText,
  ChevronDown, ChevronUp, CheckCircle2, Clock, RefreshCw, Phone, Mail, Building2,
} from "lucide-react"
import FileDropzone from "@/components/patient/FileDropzone"
import ProgressBar, { type UploadState } from "@/components/patient/ProgressBar"
import DashboardGrid from "@/components/patient/DashboardGrid"
import type { TrialMatch } from "@/types"
import { TRIAL_NAME } from "@/data/mockTrialCriteria"
import type { Message } from "@/lib/db"

// Demo pre-loaded record for Sarah Jenkins
const DEMO_SUMMARY = `ONCOLOGY CONSULTATION NOTE

Chief Complaint: Stage IIIB non-small cell lung cancer, adenocarcinoma.
Genomic profiling: [BIOMARKER] mutation confirmed. EGFR/ALK/ROS1 negative. PD-L1 TPS 22%.

Prior treatment:
- Line 1: Carboplatin + Pemetrexed x4 cycles (stable disease)
- Line 2: Docetaxel x2 cycles (progressive disease per RECIST 1.1)

Current status:
- ECOG performance status: 1
- No brain metastases (MRI brain, 6 weeks prior)
- Measurable disease: right lower lobe mass 2.8 cm
- ANC 2.1 x10^9/L, Platelets 142 x10^9/L, CrCl 68 mL/min
- No active autoimmune disease. No prior [BIOMARKER] inhibitor.`

const DEMO_MESSAGES: Message[] = [
  {
    id: "msg-demo-001",
    patientId: "patient-001",
    trialId: "mock-trial-001",
    trialName: "ONCO-KRAS-001: Sotorasib + Pembrolizumab in Advanced NSCLC",
    confidenceScore: 98,
    fromOrg: "Memorial Sloan Kettering Cancer Center",
    fromName: "Dr. Alistair Vance, Lead Coordinator",
    contactEmail: "a.vance@mskcc.org",
    contactPhone: "(212) 639-5710",
    subject: "You've been matched — and we come to you",
    body: `Dear Sarah,\n\nWe've reviewed your de-identified profile and our team has placed you in the 98th percentile for our Stage IIIB KRAS G12C NSCLC study at Memorial Sloan Kettering.\n\nHere's what makes us different: you don't travel to us — we come to you. We'll ship a genomic confirmation kit directly to your home in Ithaca, NY. If you move forward, we coordinate all transport logistics and can deploy a mobile clinical unit to your region for baseline collection. Nothing is on you.\n\nThis trial is evaluating sotorasib (AMG 510) in combination with pembrolizumab — a targeted approach designed for exactly your tumor profile. No chemotherapy in this arm.\n\nPlease review the next steps below and confirm your interest. Our coordinator will call you within 24 hours.`,
    nextSteps: [
      "Confirm your interest using the button below — no commitment required",
      "Receive your at-home genomic confirmation kit within 3 business days",
      "Complete a 20-minute telehealth screening with Dr. Vance",
      "We coordinate all travel or dispatch a mobile unit — zero logistics on your end",
    ],
    read: false,
    createdAt: new Date().toISOString(),
  },
]

export default function PatientPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [matches, setMatches] = useState<TrialMatch[]>([])
  const DEFAULT_STORY = "I was diagnosed 8 months ago with Stage IIIB NSCLC. I'm a high school art teacher — I want to keep painting and keep teaching. I'm not ready to stop, and I'm willing to do whatever it takes to find a treatment that works for my specific mutation."
  const [patientName, setPatientName] = useState("Sarah Jenkins")
  const [patientStory, setPatientStory] = useState(DEFAULT_STORY)
  const [activeTab, setActiveTab] = useState<"clinical" | "messages">("clinical")
  const [messages, setMessages] = useState<Message[]>(DEMO_MESSAGES)
  const [expandedMsg, setExpandedMsg] = useState<string | null>("msg-demo-001")
  const [fileCount, setFileCount] = useState(1)
  const [kitRequested, setKitRequested] = useState<Record<string, boolean>>({})
  const [showUpdateRecords, setShowUpdateRecords] = useState(false)
  const [recordsState, setRecordsState] = useState<"on-file" | "uploading-new" | "done">("on-file")

  useEffect(() => {
    try {
      const ctx = localStorage.getItem("userContext")
      if (ctx) {
        const parsed = JSON.parse(ctx)
        // Only override if the data looks real
        if (parsed.name && parsed.name.trim().length >= 2) setPatientName(parsed.name)
        if (parsed.story && parsed.story.trim().length > 10) setPatientStory(parsed.story)
      }
    } catch { /* ignore */ }
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages")
      if (!res.ok) return
      const data = await res.json()
      // API returns either {messages:[]} or [] directly
      const arr = Array.isArray(data) ? data : Array.isArray(data.messages) ? data.messages : []
      if (arr.length > 0) setMessages(arr)
    } catch { /* keep demo messages on network error */ }
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  // markRead is purely local — no network call needed for demo
  function markRead(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)))
    // Best-effort server sync — fire and forget, never throws
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => { /* ignore — local state already updated */ })
  }

  async function handleUploadComplete(newPatientId: string, deidentifiedSummary: string, numFiles: number) {
    setFileCount(numFiles)
    setUploadState("processing")
    setRecordsState("done")

    const userCtx = localStorage.getItem("userContext")

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userCtx ? { "x-patient-context": userCtx } : {}),
        },
        body: JSON.stringify({
          patientId: newPatientId,
          deidentifiedSummary,
          coords: { lat: 42.4440, lng: -76.5019 },
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Match failed")
      }

      const matchResult = await res.json()
      if (matchResult.isMatch) {
        setMatches([{
          ...matchResult,
          trialId: "trial-onco-001",
          trialName: TRIAL_NAME,
          location: "New York, NY · Los Angeles, CA · Chicago, IL",
          patientId: newPatientId,
        }])
        setUploadState("matched")
        setTimeout(() => fetchMessages(), 1500)
      } else {
        setMatches([])
        setUploadState("no-match")
      }
    } catch {
      setUploadState("error")
    }
  }

  async function runAnalysisOnExistingRecords() {
    setUploadState("processing")
    setShowUpdateRecords(false)

    const userCtx = localStorage.getItem("userContext")
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userCtx ? { "x-patient-context": userCtx } : {}),
        },
        body: JSON.stringify({
          patientId: "patient-001",
          deidentifiedSummary: DEMO_SUMMARY,
          coords: { lat: 42.4440, lng: -76.5019 },
        }),
      })

      if (!res.ok) throw new Error("Match failed")
      const matchResult = await res.json()

      if (matchResult.isMatch) {
        setMatches([{
          ...matchResult,
          trialId: "trial-onco-001",
          trialName: TRIAL_NAME,
          location: "New York, NY · Los Angeles, CA · Chicago, IL",
          patientId: "patient-001",
        }])
        setUploadState("matched")
        setTimeout(() => fetchMessages(), 1500)
      } else {
        setUploadState("no-match")
      }
    } catch {
      setUploadState("error")
    }
  }

  const unreadCount = messages.filter((m) => !m.read).length

  return (
    <div className="min-h-screen bg-rose-50/50 selection:bg-rose-200 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none opacity-60" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl pointer-events-none opacity-60" />

      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <span className="font-semibold text-gray-900 tracking-tight">markovHealth</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
            <Shield className="w-3.5 h-3.5" />
            <span>PHI Protected</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Patient story banner */}
        {patientStory && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-white border border-rose-100 rounded-3xl p-5 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full opacity-50" />
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-lg font-bold text-rose-600 shadow-sm">
                {patientName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">
                  {patientName ? `${patientName}'s Story` : "Your Story"}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{patientStory}&rdquo;</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-rose-100 flex items-center shadow-sm gap-1">
            <button
              onClick={() => setActiveTab("clinical")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === "clinical" ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <FileText className="w-4 h-4" />Clinical Profile
            </button>
            <button
              onClick={() => {
                setActiveTab("messages")
                if (unreadCount > 0 && messages[0]) markRead(messages[0].id)
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                activeTab === "messages" ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Messages
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Clinical Tab */}
        {activeTab === "clinical" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

            {/* Records already on file */}
            {recordsState === "on-file" && uploadState === "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="bg-white border border-emerald-200 rounded-3xl p-5 shadow-sm flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Medical records on file</p>
                      <p className="text-xs text-gray-500 mt-0.5">sarah_jenkins_ehr.pdf · Encrypted & de-identified</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={runAnalysisOnExistingRecords}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      <Activity className="w-3.5 h-3.5" />Scan for Trials
                    </button>
                    <button
                      onClick={() => setShowUpdateRecords((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-gray-500 hover:text-gray-700 text-xs font-medium rounded-xl border border-rose-100 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />Update
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showUpdateRecords && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3"
                    >
                      <div className="bg-white border border-rose-100 rounded-3xl p-5 shadow-sm">
                        <p className="text-sm font-semibold text-gray-900 mb-1">Replace or add records</p>
                        <p className="text-xs text-gray-500 mb-4">Upload updated documents. Your previous records will be replaced after verification.</p>
                        <FileDropzone
                          onUploadComplete={handleUploadComplete}
                          onProcessingStart={() => { setUploadState("uploading"); setRecordsState("uploading-new") }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* New upload (no records on file) */}
            {recordsState !== "on-file" && uploadState === "idle" && (
              <>
                <motion.div
                  key="upload-prompt"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-6"
                >
                  <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                    Welcome{patientName ? `, ${patientName}` : " to markovHealth"}
                  </h1>
                  <p className="text-gray-600 text-sm leading-relaxed max-w-lg mx-auto">
                    Upload your medical records. We&apos;ll strip all identifying information before any AI sees your data, then screen you for clinical trials actively looking for someone with your profile.
                  </p>
                </motion.div>
                <FileDropzone
                  onUploadComplete={handleUploadComplete}
                  onProcessingStart={() => setUploadState("uploading")}
                />
              </>
            )}

            {/* Security badge */}
            <div className="mt-6 bg-white/70 backdrop-blur-lg border border-white/50 rounded-3xl p-5 shadow-lg shadow-rose-100/20 max-w-xl mx-auto flex items-start gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100/30 rounded-bl-full -z-10" />
              <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-100">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">End-to-End Protected</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  All documents are stripped of PHI by an offline proxy before analysis. Raw data is never stored. Our staff has{" "}
                  <span className="font-bold text-rose-500">zero-knowledge access</span>.
                </p>
              </div>
            </div>

            {uploadState === "processing" && (
              <div className="text-center mt-10 mb-4">
                <Activity className="w-7 h-7 text-rose-400 animate-spin mx-auto mb-3" />
                <p className="text-rose-600 font-medium">Scanning active clinical trials for your profile...</p>
              </div>
            )}

            {uploadState !== "processing" && uploadState !== "idle" && <ProgressBar state={uploadState} />}

            {fileCount > 1 && uploadState !== "idle" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-gray-500 mt-2">
                {fileCount} documents analyzed together
              </motion.p>
            )}

            <AnimatePresence>
              {(uploadState === "matched" || uploadState === "no-match") && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
                  {uploadState === "matched" && (
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">Trials That Want You</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Check your{" "}
                        <button onClick={() => setActiveTab("messages")} className="text-rose-500 font-semibold underline">
                          Messages tab
                        </button>{" "}
                        — a coordinator has reached out directly.
                      </p>
                    </div>
                  )}
                  <DashboardGrid matches={matches} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Inbox</h2>

            {messages.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-rose-100 shadow-sm">
                <MessageSquare className="w-10 h-10 text-rose-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No messages yet</p>
                <p className="text-sm text-gray-400 mt-1">Once you&apos;re matched, a trial coordinator will reach out here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${
                      msg.read ? "border-rose-100" : "border-rose-300"
                    }`}
                  >
                    <button
                      className="w-full text-left p-5"
                      onClick={() => {
                        setExpandedMsg(expandedMsg === msg.id ? null : msg.id)
                        if (!msg.read) markRead(msg.id)
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow">
                          {msg.fromOrg.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-semibold truncate ${msg.read ? "text-gray-700" : "text-gray-900"}`}>
                              {msg.fromName}
                            </p>
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-xs text-indigo-600 font-medium mt-0.5">{msg.fromOrg}</p>
                          <p className={`text-sm mt-1 ${msg.read ? "text-gray-500" : "text-gray-800 font-medium"}`}>
                            {msg.subject}
                          </p>
                          {!msg.read && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs text-rose-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-gray-400">
                          {expandedMsg === msg.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 pl-[60px]">
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-semibold">
                          {msg.confidenceScore}% match · {msg.trialName}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedMsg === msg.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5 border-t border-rose-50 pt-4">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-5">{msg.body}</p>

                            {/* Direct contact info */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                Reach out directly — no platform needed
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <span className="font-medium text-gray-900 w-16 text-xs">Name</span>
                                  <span>{msg.fromName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-gray-900 w-16 text-xs">Org</span>
                                  <span className="text-gray-700">{msg.fromOrg}</span>
                                </div>
                                {msg.contactEmail && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 w-16 text-xs">Email</span>
                                    <a
                                      href={`mailto:${msg.contactEmail}`}
                                      className="text-indigo-600 font-medium text-sm hover:underline flex items-center gap-1"
                                    >
                                      <Mail className="w-3.5 h-3.5" />{msg.contactEmail}
                                    </a>
                                  </div>
                                )}
                                {msg.contactPhone && (
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 w-16 text-xs">Phone</span>
                                    <a
                                      href={`tel:${msg.contactPhone}`}
                                      className="text-indigo-600 font-medium text-sm hover:underline flex items-center gap-1"
                                    >
                                      <Phone className="w-3.5 h-3.5" />{msg.contactPhone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {msg.nextSteps.length > 0 && (
                              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-rose-500" />
                                  Your Next Steps
                                </h4>
                                <ol className="space-y-2">
                                  {msg.nextSteps.map((step, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                                        {i + 1}
                                      </span>
                                      <span className="text-sm text-gray-700">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            <button
                              onClick={async () => {
                                setKitRequested((prev) => ({ ...prev, [msg.id]: true }))
                                try {
                                  await fetch("/api/confirm", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ patientId: msg.patientId })
                                  })
                                } catch (e) { /* silent fail */ }
                              }}
                              disabled={kitRequested[msg.id]}
                              className={`mt-4 w-full py-2.5 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 shadow ${
                                kitRequested[msg.id]
                                  ? "bg-emerald-500 cursor-default"
                                  : "bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {kitRequested[msg.id]
                                ? "Confirmed — Kit En Route. Coordinator will call within 24h."
                                : "Confirm Interest & Request Kit"}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
