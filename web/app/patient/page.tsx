"use client"
import { useState, useEffect, useCallback } from "react"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, LogOut, Shield, Heart, MessageSquare, FileText, ChevronDown, ChevronUp, CheckCircle2, Clock } from "lucide-react"
import FileDropzone from "@/components/patient/FileDropzone"
import ProgressBar, { type UploadState } from "@/components/patient/ProgressBar"
import DashboardGrid from "@/components/patient/DashboardGrid"
import type { TrialMatch } from "@/types"
import { TRIAL_NAME } from "@/data/mockTrialCriteria"
import type { Message } from "@/lib/db"

export default function PatientPage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [matches, setMatches] = useState<TrialMatch[]>([])
  const [patientName, setPatientName] = useState("")
  const [patientStory, setPatientStory] = useState("")
  const [activeTab, setActiveTab] = useState<"clinical" | "messages">("clinical")
  const [messages, setMessages] = useState<Message[]>([])
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState(0)

  useEffect(() => {
    const ctx = localStorage.getItem("userContext")
    if (ctx) {
      try {
        const parsed = JSON.parse(ctx)
        if (parsed.name) setPatientName(parsed.name.split(" ")[0])
        if (parsed.story) setPatientStory(parsed.story)
      } catch { /* safe fail */ }
    }
  }, [])

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages")
      if (res.ok) {
        const { messages: msgs } = await res.json()
        setMessages(msgs)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  async function markRead(id: string) {
    await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, read: true } : m))
  }

  async function handleUploadComplete(newPatientId: string, deidentifiedSummary: string, numFiles: number) {
    setFileCount(numFiles)
    setUploadState("processing")

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
          coords: { lat: 40.7128, lng: -74.006 },
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
        // Fetch newly created message after a short delay
        setTimeout(fetchMessages, 1500)
      } else {
        setMatches([])
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

      {/* Nav */}
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
          <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 font-medium transition-colors">
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
              <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-rose-600">
                {patientName?.[0] ?? "P"}
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
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === "clinical" ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-gray-500 hover:text-gray-900"}`}
            >
              <FileText className="w-4 h-4" />Clinical Profile
            </button>
            <button
              onClick={() => { setActiveTab("messages"); if (unreadCount > 0 && messages[0]) markRead(messages[0].id) }}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all relative ${activeTab === "messages" ? "bg-rose-500 text-white shadow-md shadow-rose-200" : "text-gray-500 hover:text-gray-900"}`}
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
            <AnimatePresence mode="wait">
              {uploadState === "idle" && (
                <motion.div key="upload" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="text-center mb-10">
                  <h1 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                    Welcome{patientName ? `, ${patientName}` : " to markovHealth"}
                  </h1>
                  <p className="text-gray-600 text-base leading-relaxed max-w-lg mx-auto">
                    Let&apos;s find the care you deserve. Upload your medical records and we&apos;ll securely screen you for clinical trials that are actively looking for someone just like you.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <FileDropzone
              onUploadComplete={handleUploadComplete}
              onProcessingStart={() => setUploadState("uploading")}
            />

            {fileCount > 1 && uploadState !== "idle" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs text-gray-500 mt-2">
                {fileCount} documents analyzed together
              </motion.p>
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
                <p className="text-rose-600 font-medium">Screening your records against active trials…</p>
                <p className="text-xs text-gray-400 mt-1">This usually takes 10–20 seconds</p>
              </div>
            )}

            {uploadState !== "processing" && <ProgressBar state={uploadState} />}

            <AnimatePresence>
              {(uploadState === "matched" || uploadState === "no-match") && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
                  {uploadState === "matched" && (
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-bold text-gray-900">Trials That Want You</h2>
                      <p className="text-sm text-gray-500 mt-1">Check your <button onClick={() => setActiveTab("messages")} className="text-rose-500 font-semibold underline">Messages tab</button> — a coordinator has reached out.</p>
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
                    className={`bg-white border rounded-3xl shadow-sm overflow-hidden transition-shadow hover:shadow-md ${msg.read ? "border-rose-100" : "border-rose-300"}`}
                  >
                    {/* Message header */}
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

                      {/* Match score chip */}
                      <div className="mt-3 ml-15 flex items-center gap-2 pl-[60px]">
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-semibold">
                          {msg.confidenceScore}% match · {msg.trialName}
                        </span>
                      </div>
                    </button>

                    {/* Expanded body */}
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

                            <button className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 shadow">
                              <CheckCircle2 className="w-4 h-4" />
                              Confirm Interest & Request Kit
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
