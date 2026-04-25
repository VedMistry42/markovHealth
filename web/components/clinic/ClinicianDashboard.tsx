"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Send, Filter, MapPin } from "lucide-react"
import { PATIENT_ARCHETYPES } from "@/lib/sampleData"

export default function ClinicianDashboard() {
  const [criteria, setCriteria] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [notifiedPatients, setNotifiedPatients] = useState<string[]>([])

  const handleSearch = () => {
    setIsSearching(true)
    setTimeout(() => {
      setIsSearching(false)
      setShowMatches(true)
    }, 1500)
  }

  const handleNotify = async (patientId: string) => {
    setNotifiedPatients(prev => [...prev, patientId])
    // Simulate webhook to RL backend
    try {
      await fetch('/api/match', {
         method: 'POST',
         body: JSON.stringify({ patientId, trialId: 'mock-trial-001', coords: { lat: 0, lng: 0 }})
      })
    } catch {
      // Ignore webhook failure
    }
  }

  // Simulated match scores for the archetypes
  const scores = { "arch-1": 98, "arch-2": 45, "arch-3": 12 }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute top-4 right-4 w-[400px] h-[calc(100vh-80px)] flex flex-col gap-4 z-10"
    >
      {/* Trial Creation Input Section */}
      <div className="bg-white/95 backdrop-blur-md border border-rose-100 rounded-3xl p-5 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-semibold text-gray-900 tracking-wide">TRIAL CRITERIA</h2>
          </div>
          <label className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center">
            Upload Protocol
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.txt"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                   setCriteria(`[Parsed from ${e.target.files[0].name}]\n\nMust have Stage III NSCLC, ECOG 1. Exclude if brain mets are present. Ensure genomic confirmation.`)
                }
              }}
            />
          </label>
        </div>
        <textarea 
          className="w-full bg-gray-50 border border-rose-100 rounded-2xl p-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-rose-200 resize-none h-24 mb-3 placeholder-gray-400 font-medium"
          placeholder="e.g., Must have Stage III NSCLC, ECOG 1. Exclude if brain mets are present."
          value={criteria}
          onChange={e => setCriteria(e.target.value)}
        />
        <button 
          onClick={handleSearch}
          disabled={!criteria || isSearching}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isSearching ? <Activity className="w-4 h-4 animate-spin" /> : "Find Matches"}
        </button>
      </div>

      {/* Human-Focused Match Dashboard */}
      <div className="bg-white/95 backdrop-blur-md border border-indigo-100 rounded-3xl p-5 shadow-lg flex-1 overflow-hidden flex flex-col">
        <h2 className="text-sm font-semibold text-gray-900 tracking-wide mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          POTENTIAL MATCHES
        </h2>
        
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          <AnimatePresence>
            {!showMatches ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col justify-center items-center text-center text-gray-500 p-4">
                <Activity className="w-8 h-8 text-rose-200 mb-2" />
                <p className="text-sm">Input your trial criteria above to discover eligible patients in your region.</p>
              </motion.div>
            ) : (
              PATIENT_ARCHETYPES.map((p, i) => {
                const score = scores[p.id as keyof typeof scores]
                const isNotified = notifiedPatients.includes(p.id)
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="border border-indigo-50 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-rose-50 to-transparent rounded-bl-3xl -z-10 group-hover:from-rose-100 transition-colors" />
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{p.name}, {p.age}</h3>
                        <p className="flex items-center gap-1 text-xs font-medium text-indigo-500 mt-0.5">
                          <MapPin className="w-3 h-3" /> {p.location} (approx. 12 mi)
                        </p>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className={`text-xl font-bold ${score > 80 ? 'text-emerald-500' : score > 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {score}%
                        </span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Match</span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs leading-relaxed line-clamp-3 mb-3">
                      &ldquo;{p.clinicalText}&rdquo;
                    </p>
                    <button 
                      onClick={() => handleNotify(p.id)}
                      disabled={isNotified}
                      className={`w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${isNotified ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                      {isNotified ? "Connecting for Logistics..." : "Send Message & Add to Network"}
                      {!isNotified && <Send className="w-3 h-3" />}
                    </button>
                  </motion.div>
                )
              })
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

