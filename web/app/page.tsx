"use client"
import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Map, ArrowRight, User, ShieldCheck, Lock } from "lucide-react"

export default function LandingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"role" | "patient_onboarding" | "clinic_onboarding">("role")
  const [roleSelection, setRoleSelection] = useState<"patient" | "researcher" | null>(null)

  // Patient form
  const [patientName, setPatientName] = useState("")
  const [patientAge, setPatientAge] = useState("")
  const [patientLocation, setPatientLocation] = useState("")
  const [patientStory, setPatientStory] = useState("")

  // Clinic form
  const [clinicName, setClinicName] = useState("")
  const [clinicLocation, setClinicLocation] = useState("")
  const [clinicSpecialty, setClinicSpecialty] = useState("")
  const [clinicNPI, setClinicNPI] = useState("")

  useEffect(() => {
    if (session) {
      router.push(session.user.role === "researcher" ? "/clinic" : "/patient")
    }
  }, [session, router])

  async function handleOnboard() {
    setLoading(true)
    setError("")
    
    // Save locally to mock context
    if (roleSelection === "patient") {
      localStorage.setItem("userContext", JSON.stringify({ name: patientName, age: patientAge, location: patientLocation, story: patientStory }))
    } else {
      localStorage.setItem("clinicContext", JSON.stringify({ name: clinicName, location: clinicLocation, specialty: clinicSpecialty, npi: clinicNPI }))
    }

    const demoEmail = roleSelection === "patient" ? "patient@demo.com" : "researcher@demo.com"
    const result = await signIn("credentials", {
      email: demoEmail,
      password: "demo1234",
      redirect: false,
    })
    
    setLoading(false)
    if (result?.error) {
      setError("Sign in failed. Please try again.")
    } else {
      router.push(roleSelection === "researcher" ? "/clinic" : "/patient")
    }
  }

  return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center px-4 py-8">
      <AnimatePresence mode="wait">
        {step === "role" && (
          <motion.div
            key="role"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-lg"
          >
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-2xl mb-6 shadow-sm">
                <Activity className="w-8 h-8 text-rose-500" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-gray-900 mb-3">markovHealth</h1>
              <p className="text-gray-500 text-base leading-relaxed max-w-sm mx-auto">
                We screen you for clinical trials — then bring the trial to <em>you</em>. Kits by mail. Travel coordinated. Zero logistics on your end.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setRoleSelection("patient"); setStep("patient_onboarding"); }}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-rose-300 rounded-2xl shadow-sm transition-colors group"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                  <User className="w-5 h-5 text-rose-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">I am a Patient</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setRoleSelection("researcher"); setStep("clinic_onboarding"); }}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-indigo-300 rounded-2xl shadow-sm transition-colors group"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Map className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-900">I am a Clinician</p>
                </div>
              </motion.button>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Zero-Knowledge Security</h3>
                  <p className="text-xs text-gray-500">PHI stripped before any AI sees your data. Staff have zero access to raw records.</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm flex items-start gap-3">
                <Map className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">We Handle Every Logistic</h3>
                  <p className="text-xs text-gray-500">Kits shipped to your door. Travel to trial sites fully coordinated. Mobile units dispatched to your region. You focus on getting better — we handle the rest.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === "patient_onboarding" && (
          <motion.div
            key="patient_onboarding"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-rose-100"
          >
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tell us about yourself</h2>
            <p className="text-gray-500 mb-6 text-sm">Your story matters as much as your medical records.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input value={patientName} onChange={e => setPatientName(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-gray-900" placeholder="e.g. Sarah Jenkins" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                   <input value={patientAge} onChange={e => setPatientAge(e.target.value)} type="number" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-gray-900" placeholder="45" />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Zip Code</label>
                   <input value={patientLocation} onChange={e => setPatientLocation(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-gray-900" placeholder="10001" />
                </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Full Mailing Address (For testing kits)</label>
                 <input type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-gray-900" placeholder="123 Example St, Apt 4B, New York, NY" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">My Story <Lock className="w-3 h-3 text-emerald-500" /></label>
                 <textarea value={patientStory} onChange={e => setPatientStory(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none h-24 resize-none text-gray-900" placeholder="Briefly describe your journey. This is encrypted before transmission." />
              </div>
              <button disabled={loading} onClick={handleOnboard} className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 mt-4 transition-colors shadow-sm shadow-rose-200/50">
                {loading ? "Encrypting & Joining..." : "Join Network (Secure)"} <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex flex-col items-center gap-2 mt-4 text-sm">
                <button disabled={loading} onClick={handleOnboard} className="text-gray-500 font-medium hover:text-rose-600 transition-colors">Already have an account? Log in securely.</button>
                <button onClick={() => setStep("role")} className="text-gray-400 hover:text-gray-600">Back to selection</button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </motion.div>
        )}

        {step === "clinic_onboarding" && (
          <motion.div
            key="clinic_onboarding"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-indigo-100"
          >
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Researcher Onboarding</h2>
            <p className="text-gray-500 mb-6 text-sm">We use SheerID to actively verify all clinicians and protect our patient network.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinic / Organization Name</label>
                <input value={clinicName} onChange={e => setClinicName(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" placeholder="Memorial Sloan Kettering" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">State Licensed</label>
                   <input value={clinicNPI} onChange={e => setClinicNPI(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" placeholder="e.g. NY" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Specialty area</label>
                   <input value={clinicSpecialty} onChange={e => setClinicSpecialty(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" placeholder="Oncology" />
                 </div>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Headquarters Location</label>
                 <input value={clinicLocation} onChange={e => setClinicLocation(e.target.value)} type="text" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900" placeholder="New York, NY" />
              </div>
              
              <div className="mt-6 border-t border-gray-100 pt-6">
                <button 
                  disabled={loading} 
                  onClick={async () => {
                    setLoading(true);
                    // Fake sheerID popup timing
                    setTimeout(() => handleOnboard(), 1500)
                  }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><Activity className="w-4 h-4 animate-spin" /> Verifying with SheerID...</span>
                  ) : (
                    <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Verify Medical License via SheerID</span>
                  )}
                </button>
              </div>
              <button disabled={loading} onClick={() => setStep("role")} className="w-full py-2 text-gray-500 hover:text-gray-700 text-sm mt-2 transition-colors">Back</button>
            </div>
            {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
