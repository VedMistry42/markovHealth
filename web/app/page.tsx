"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, ArrowRight, User, ShieldCheck, Lock, Building2, Loader2, LogIn } from "lucide-react"

type Step = "role" | "patient" | "clinic" | "login"

export default function LandingPage() {
  const router = useRouter()
  const [step, setStep]       = useState<Step>("role")
  const [error, setError]     = useState("")
  const [loading, setLoading] = useState(false)

  // Patient signup fields
  const [pName,  setPName]  = useState("")
  const [pEmail, setPEmail] = useState("")
  const [pPw,    setPPw]    = useState("")
  const [pPhone, setPPhone] = useState("")
  const [pAge,   setPAge]   = useState("")
  const [pZip,   setPZip]   = useState("")
  const [pStory, setPStory] = useState("")

  // Clinic signup fields
  const [cName,      setCName]      = useState("")
  const [cEmail,     setCEmail]     = useState("")
  const [cPw,        setCPw]        = useState("")
  const [cPhone,     setCPhone]     = useState("")
  const [cOrg,       setCOrg]       = useState("")
  const [cSpecialty, setCSpecialty] = useState("")
  const [cLocation,  setCLocation]  = useState("")

  // Login fields
  const [lEmail, setLEmail] = useState("")
  const [lPw,    setLPw]    = useState("")

  async function registerAndLogin(role: "patient" | "researcher") {
    setLoading(true); setError("")
    const body = role === "patient"
      ? { role, name: pName, email: pEmail, password: pPw, phone: pPhone, age: pAge, zip: pZip, story: pStory }
      : { role, name: cName, email: cEmail, password: cPw, phone: cPhone, orgName: cOrg, specialty: cSpecialty, location: cLocation }
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Registration failed"); setLoading(false); return }
      const result = await signIn("credentials", {
        email: role === "patient" ? pEmail : cEmail,
        password: role === "patient" ? pPw : cPw,
        redirect: false,
      })
      if (result?.error) { setError("Sign-in failed — try again.") }
      else { router.push(role === "researcher" ? "/clinic" : "/patient") }
    } catch { setError("Network error — try again.") }
    setLoading(false)
  }

  async function login() {
    setLoading(true); setError("")
    try {
      const result = await signIn("credentials", { email: lEmail, password: lPw, redirect: false })
      if (result?.error) { setError("Incorrect email or password."); setLoading(false); return }
      // Detect role from profile
      const res = await fetch("/api/patient/profile")
      if (res.ok) {
        const u = await res.json()
        router.push(u.role === "researcher" ? "/clinic" : "/patient")
      } else {
        router.push("/patient")
      }
    } catch { setError("Network error — try again.") }
    setLoading(false)
  }

  const inp = (accent: string) =>
    `w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-${accent}-400 outline-none text-gray-900 text-sm bg-white`

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-rose-50 flex flex-col items-center justify-center px-4 py-8">
      <AnimatePresence mode="wait">

        {/* ── Role selector ── */}
        {step === "role" && (
          <motion.div key="role" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.4 }} className="w-full max-w-lg">
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-2xl mb-6 shadow-sm">
                <Activity className="w-8 h-8 text-rose-500" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-gray-900 mb-3">markovHealth</h1>
              <p className="text-gray-500 text-base leading-relaxed max-w-sm mx-auto">
                We screen patients for clinical trials and bring the trial to <em>them</em>.
                Kits by mail. Travel coordinated. Zero logistics on your end.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setStep("patient")}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-rose-300 rounded-2xl shadow-sm transition-colors group">
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                  <User className="w-5 h-5 text-rose-500" />
                </div>
                <p className="font-medium text-gray-900">I am a Patient</p>
                <p className="text-xs text-gray-400">Create new account</p>
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setStep("clinic")}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-indigo-300 rounded-2xl shadow-sm transition-colors group">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Building2 className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="font-medium text-gray-900">I am a Clinician</p>
                <p className="text-xs text-gray-400">Create new account</p>
              </motion.button>
            </div>
            <button onClick={() => setStep("login")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors shadow-sm mb-6">
              <LogIn className="w-4 h-4" />Already have an account? Sign in
            </button>
            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-rose-100 shadow-sm flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Zero-Knowledge Security</h3>
                  <p className="text-xs text-gray-500">PHI stripped before any AI sees your data. Staff have zero access to raw records.</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm flex items-start gap-3">
                <Activity className="w-6 h-6 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-0.5">We Handle Every Logistic</h3>
                  <p className="text-xs text-gray-500">Kits shipped to your door. Travel coordinated. Mobile units dispatched to your region.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Sign in ── */}
        {step === "login" && (
          <motion.div key="login" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <LogIn className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Sign in</h2>
                <p className="text-gray-400 text-xs">Welcome back</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={lEmail} onChange={e => setLEmail(e.target.value)} type="email"
                  className={inp("gray")} placeholder="you@example.com"
                  onKeyDown={e => e.key === "Enter" && login()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input value={lPw} onChange={e => setLPw(e.target.value)} type="password"
                  className={inp("gray")} placeholder="••••••••"
                  onKeyDown={e => e.key === "Enter" && login()} />
              </div>
              <button disabled={loading || !lEmail || !lPw}
                onClick={login}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors shadow-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</>
                  : <><ArrowRight className="w-4 h-4" />Sign in</>}
              </button>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <button onClick={() => { setStep("role"); setError("") }}
                className="w-full text-gray-400 hover:text-gray-600 text-sm py-1">Back</button>
            </div>
          </motion.div>
        )}

        {/* ── Patient signup ── */}
        {step === "patient" && (
          <motion.div key="patient" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-rose-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Create your patient account</h2>
            <p className="text-gray-500 mb-6 text-sm">Your story matters as much as your medical records.</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <input value={pName} onChange={e => setPName(e.target.value)} className={inp("rose")} placeholder="Bob Chen" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                  <input value={pAge} onChange={e => setPAge(e.target.value)} type="number" className={inp("rose")} placeholder="52" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={pEmail} onChange={e => setPEmail(e.target.value)} type="email" className={inp("rose")} placeholder="bob@example.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <input value={pPw} onChange={e => setPPw(e.target.value)} type="password" className={inp("rose")} placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input value={pPhone} onChange={e => setPPhone(e.target.value)} className={inp("rose")} placeholder="(607) 555-0100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Zip Code (for kit shipping)</label>
                <input value={pZip} onChange={e => setPZip(e.target.value)} className={inp("rose")} placeholder="14850" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                  Your Story <Lock className="w-3 h-3 text-emerald-500" />
                </label>
                <textarea value={pStory} onChange={e => setPStory(e.target.value)}
                  className={`${inp("rose")} h-24 resize-none`}
                  placeholder="Tell us about yourself. This helps coordinators see you as a person, not a data point." />
              </div>
              <button disabled={loading || !pName || !pEmail || !pPw}
                onClick={() => registerAndLogin("patient")}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors shadow-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
                  : <><ArrowRight className="w-4 h-4" />Join as Patient</>}
              </button>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <div className="flex items-center justify-between">
                <button onClick={() => { setStep("role"); setError("") }} className="text-gray-400 hover:text-gray-600 text-sm py-1">Back</button>
                <button onClick={() => { setStep("login"); setError("") }} className="text-indigo-500 hover:text-indigo-700 text-sm py-1">Already have an account?</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Clinic signup ── */}
        {step === "clinic" && (
          <motion.div key="clinic" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-indigo-100">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Create your clinic account</h2>
            <p className="text-gray-500 mb-6 text-sm">Upload trial protocols and we&apos;ll route eligible patients to you.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Your Name</label>
                <input value={cName} onChange={e => setCName(e.target.value)} className={inp("indigo")} placeholder="Dr. Emily Chen" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Organization</label>
                <input value={cOrg} onChange={e => setCOrg(e.target.value)} className={inp("indigo")} placeholder="Memorial Sloan Kettering" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Specialty</label>
                  <input value={cSpecialty} onChange={e => setCSpecialty(e.target.value)} className={inp("indigo")} placeholder="Oncology" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                  <input value={cLocation} onChange={e => setCLocation(e.target.value)} className={inp("indigo")} placeholder="New York, NY" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input value={cEmail} onChange={e => setCEmail(e.target.value)} type="email" className={inp("indigo")} placeholder="dr.chen@mskcc.org" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                  <input value={cPw} onChange={e => setCPw(e.target.value)} type="password" className={inp("indigo")} placeholder="••••••••" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Direct Phone</label>
                  <input value={cPhone} onChange={e => setCPhone(e.target.value)} className={inp("indigo")} placeholder="(212) 639-5710" />
                </div>
              </div>
              <button disabled={loading || !cName || !cEmail || !cPw || !cOrg}
                onClick={() => registerAndLogin("researcher")}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl flex items-center justify-center gap-2 mt-2 transition-colors shadow-sm">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
                  : <><ShieldCheck className="w-4 h-4" />Create Clinic Account</>}
              </button>
              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
              <div className="flex items-center justify-between">
                <button onClick={() => { setStep("role"); setError("") }} className="text-gray-400 hover:text-gray-600 text-sm py-1">Back</button>
                <button onClick={() => { setStep("login"); setError("") }} className="text-indigo-500 hover:text-indigo-700 text-sm py-1">Already have an account?</button>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
