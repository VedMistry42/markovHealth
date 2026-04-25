"use client"
import { useState, useEffect, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, LogOut, Shield, Heart, MessageSquare, FileText,
  ChevronDown, ChevronUp, CheckCircle2, Clock, RefreshCw, Phone, Mail, Building2, Upload,
} from "lucide-react"
import type { UploadState } from "@/components/patient/ProgressBar"
import ProgressBar from "@/components/patient/ProgressBar"

interface Message {
  id: string; patientId: string; trialId: string; trialName: string
  confidenceScore: number; fromOrg: string; fromName: string
  contactEmail: string; contactPhone: string
  subject: string; body: string; nextSteps: string[]; read: boolean; createdAt: string
}

export default function PatientPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<"clinical" | "messages">("clinical")
  const [messages,  setMessages]  = useState<Message[]>([])
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [hasRecords,  setHasRecords]  = useState(false)
  const [showUpload,  setShowUpload]  = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [fileError,   setFileError]   = useState("")

  const name  = session?.user?.name ?? "Patient"
  const story = session?.user?.story ?? ""

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages")
      if (!res.ok) return
      const data: Message[] = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setMessages(prev => {
          // Auto-switch to messages tab when first message arrives
          if (prev.length === 0 && data.length > 0) {
            setActiveTab("messages")
          }
          return data
        })
      }
    } catch { /* keep existing */ }
  }, [])

  useEffect(() => { fetchMessages() }, [fetchMessages])
  useEffect(() => {
    const id = setInterval(fetchMessages, 1500)
    return () => clearInterval(id)
  }, [fetchMessages])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    e.target.value = ""
    setFileError("")
    setUploading(true)
    setUploadState("uploading")

    const fd = new FormData()
    files.forEach(f => fd.append("file", f))

    try {
      const upRes = await fetch("/api/upload", { method: "POST", body: fd })
      if (!upRes.ok) {
        const b = await upRes.json().catch(() => ({}))
        throw new Error(b.error ?? "Upload failed")
      }
      await upRes.json()
      setHasRecords(true)
      setShowUpload(false)
      setUploadState("matched")
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Upload failed")
      setUploadState("error")
    }
    setUploading(false)
  }

  async function confirmInterest(msg: Message) {
    try {
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: msg.id, confirm: true }),
      })
      setConfirmed(prev => ({ ...prev, [msg.id]: true }))
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    } catch { /* ignore */ }
  }

  async function markRead(id: string) {
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {})
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))
  }

  const unread = messages.filter(m => !m.read).length

  return (
    <div className="min-h-screen bg-rose-50/50 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="border-b border-rose-100 bg-white/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <span className="font-semibold text-gray-900">markovHealth</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
            <Shield className="w-3.5 h-3.5" />PHI Protected
          </div>
          <button onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-600 font-medium transition-colors">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Story banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-8 bg-white border border-rose-100 rounded-3xl p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 rounded-bl-full opacity-50" />
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold text-rose-600">
              {name[0]?.toUpperCase() ?? "P"}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{name}&apos;s Story</p>
              {story ? (
                <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{story}&rdquo;</p>
              ) : (
                <p className="text-sm text-gray-400 italic">No story shared yet — your story helps coordinators see you as a person, not a data point.</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/80 backdrop-blur-md p-1 rounded-2xl border border-rose-100 flex items-center shadow-sm gap-1">
            {(["clinical", "messages"] as const).map(tab => (
              <button key={tab}
                onClick={() => { setActiveTab(tab); if (tab === "messages" && unread > 0) markRead(messages[0]?.id) }}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                  activeTab === tab ? "bg-rose-500 text-white shadow-md" : "text-gray-500 hover:text-gray-900"
                }`}>
                {tab === "clinical" ? <FileText className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                {tab === "clinical" ? "Clinical Profile" : "Messages"}
                {tab === "messages" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow border-2 border-white">
                    {unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Clinical tab ── */}
        {activeTab === "clinical" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

            {/* Records status */}
            {hasRecords ? (
              <div className="mb-4 bg-white border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Medical records on file</p>
                    <p className="text-xs text-gray-400">De-identified & encrypted</p>
                  </div>
                </div>
                <button onClick={() => setShowUpload(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-medium transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />Update
                </button>
              </div>
            ) : (
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {name}</h1>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Upload your medical records. We strip all identifying info before any AI sees your data, then match you to active clinical trials.
                </p>
              </div>
            )}

            {/* Upload area */}
            <AnimatePresence>
              {(!hasRecords || showUpload) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                  <label className={`flex flex-col items-center justify-center gap-3 w-full h-44 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    uploading ? "border-rose-300 bg-rose-50" : "border-rose-200 bg-white hover:border-rose-300 hover:bg-rose-50/50"
                  }`}>
                    <Upload className={`w-8 h-8 ${uploading ? "text-rose-400 animate-pulse" : "text-rose-300"}`} />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-800">{uploading ? "Uploading..." : "Click or drag to upload"}</p>
                      <p className="text-xs text-gray-400 mt-1">PDF or TXT · Up to 5 files · Max 5MB each</p>
                    </div>
                    <input type="file" accept=".pdf,.txt" multiple className="hidden"
                      disabled={uploading} onChange={handleFileUpload} />
                  </label>
                  {fileError && <p className="text-red-500 text-xs mt-2 text-center">{fileError}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Security badge */}
            <div className="bg-white/70 border border-white/50 rounded-2xl p-4 flex items-start gap-3 shadow-sm mb-4">
              <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 leading-relaxed">
                All documents are stripped of PHI before analysis. Raw data is never stored.
                Our staff has <span className="font-bold text-rose-500">zero-knowledge access</span>.
              </p>
            </div>

            {/* Progress */}
            {uploadState === "processing" && (
              <div className="text-center mt-6">
                <Activity className="w-6 h-6 text-rose-400 animate-spin mx-auto mb-2" />
                <p className="text-rose-600 font-medium text-sm">Scanning active trials for your profile...</p>
              </div>
            )}
            {uploadState !== "idle" && uploadState !== "processing" && <ProgressBar state={uploadState} />}

            {uploadState === "matched" && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h2 className="text-lg font-bold text-gray-900">Records stored safely</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                  Your records are in the system. When a trial coordinator finds a match, they&apos;ll reach out via your{" "}
                  <button onClick={() => setActiveTab("messages")} className="text-rose-500 font-semibold underline">
                    Messages tab
                  </button>.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── Messages tab ── */}
        {activeTab === "messages" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Inbox</h2>

            {messages.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-rose-100 shadow-sm">
                <MessageSquare className="w-10 h-10 text-rose-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No messages yet</p>
                <p className="text-sm text-gray-400 mt-1">Once matched, a trial coordinator will reach out here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`bg-white border rounded-3xl shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                      msg.read ? "border-rose-100" : "border-rose-300"
                    }`}>
                    {/* Header */}
                    <button className="w-full text-left p-5"
                      onClick={() => { setExpanded(expanded === msg.id ? null : msg.id); if (!msg.read) markRead(msg.id) }}>
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow">
                          {msg.fromOrg.split(" ").map(w => w[0]).slice(0, 2).join("")}
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
                          <p className={`text-sm mt-1 ${msg.read ? "text-gray-500" : "text-gray-800 font-medium"}`}>{msg.subject}</p>
                          {!msg.read && (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs text-rose-600 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />New
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 flex-shrink-0">
                          {expanded === msg.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      <div className="mt-3 pl-[60px]">
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-semibold">
                          {msg.confidenceScore}% match · {msg.trialName}
                        </span>
                      </div>
                    </button>

                    {/* Expanded */}
                    <AnimatePresence>
                      {expanded === msg.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="px-5 pb-5 border-t border-rose-50 pt-4">
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-5">{msg.body}</p>

                            {/* Coordinator contact info */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
                              <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                Contact directly — no platform needed
                              </h4>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <span className="text-xs font-medium text-gray-500 w-14">Name</span>
                                  <span className="font-medium">{msg.fromName}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                  <span className="text-xs font-medium text-gray-500 w-14">Org</span>
                                  <span>{msg.fromOrg}</span>
                                </div>
                                {msg.contactEmail && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 w-14">Email</span>
                                    <a href={`mailto:${msg.contactEmail}`}
                                      className="text-indigo-600 font-medium text-sm hover:underline flex items-center gap-1">
                                      <Mail className="w-3.5 h-3.5" />{msg.contactEmail}
                                    </a>
                                  </div>
                                )}
                                {msg.contactPhone && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 w-14">Phone</span>
                                    <a href={`tel:${msg.contactPhone}`}
                                      className="text-indigo-600 font-medium text-sm hover:underline flex items-center gap-1">
                                      <Phone className="w-3.5 h-3.5" />{msg.contactPhone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Next steps */}
                            {msg.nextSteps.length > 0 && (
                              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4">
                                <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-rose-500" />Your Next Steps
                                </h4>
                                <ol className="space-y-2">
                                  {msg.nextSteps.map((step, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                      <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">{i + 1}</span>
                                      <span className="text-sm text-gray-700">{step}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Confirm button */}
                            {confirmed[msg.id] ? (
                              <div className="flex items-center gap-2 justify-center py-3 text-emerald-600 font-semibold text-sm">
                                <CheckCircle2 className="w-5 h-5" />
                                Confirmed — kit en route. Coordinator will call within 24h.
                              </div>
                            ) : (
                              <button onClick={() => confirmInterest(msg)}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 shadow transition-colors">
                                <CheckCircle2 className="w-4 h-4" />
                                Confirm Interest — Request Your Kit
                              </button>
                            )}
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
