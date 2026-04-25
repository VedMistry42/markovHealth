"use client"
import dynamic from "next/dynamic"
import { signOut } from "next-auth/react"
import { motion } from "framer-motion"
import { Activity, LogOut, BarChart2 } from "lucide-react"
import Link from "next/link"
import ClinicianDashboard from "@/components/clinic/ClinicianDashboard"

// Mapbox must be client-only — SSR will fail due to browser globals
const ResearcherMap = dynamic(() => import("@/components/clinic/ResearcherMap"), { ssr: false })

export default function ClinicPage() {
  return (
    <div className="h-screen w-screen bg-white flex flex-col overflow-hidden">
      {/* Clinician Minimal top bar - Warm theme now instead of dark mode */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-rose-100 bg-white/80 backdrop-blur-sm z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-500" />
          <span className="font-semibold text-gray-900 text-lg">markovHealth <span className="font-light text-gray-400">Clinic</span></span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/clinic/trials" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            <BarChart2 className="w-4 h-4" />Trial Status
          </Link>
          <button onClick={() => signOut({ callbackUrl: "/" })} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-rose-500 transition-colors">
            <LogOut className="w-4 h-4" />Exit
          </button>
        </div>
      </div>

      {/* Full-screen map with overlay */}
      <div className="flex-1 relative">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <ResearcherMap />
        </motion.div>

        <ClinicianDashboard />
      </div>
    </div>
  )
}

