"use client"
import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Activity, Map, ArrowRight, User, ShieldCheck, Lock, Phone, Mail, Home, Eye, EyeOff } from "lucide-react"

type Step = "role" | "patient_register" | "clinic_register" | "login"

export default function LandingPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>("role")
  const [showPw, setShowPw] = useState(false)

  // Shared auth fields
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [phone, setPhone] = useState("")

  // Patient-only
  const [address, setAddress] = useState("")
  const [age, setAge] = useState("")
  const [story, setStory] = useState("")

  // Clinic-only
  const [orgName, setOrgName] = useState("")
  const [specialty, setSpecialty] = useState("")
  const [npi, setNpi] = useState("")

  // Login fields
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  useEffect(() => {
    if (session) {
      router.push(session.user.role === "researcher" ? "/clinic" : "/patient")
    }
  }, [session, router])

  async function handleRegister(role: "patient" | "researcher") {
    setLoading(true)
    setError("")

    const payload = role === "patient"
      ? { email, password, role, displayName, phone, address }
      : { email, password, role, displayName: orgName, phone }

    // Save extra context locally for pre-population
    if (role === "patient") {
      localStorage.setItem("userContext", JSON.stringify({ name: displayName, age, story, phone, address }))
    } else {
      localStorage.setItem("clinicContext", JSON.stringify({ name: orgName, specialty, npi, phone }))
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Registration failed")
        setLoading(false)
        return
      }
    } catch {
      setError("Network error — please try again")
      setLoading(false)
      return
    }

    // Auto sign-in after registration
    const result = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError("Registered but sign-in failed. Try logging in.")
    } else {
      router.push(role === "researcher" ? "/clinic" : "/patient")
    }
  }

  async function handleLogin() {
    setLoading(true)
    setError("")
    const result = await signIn("credentials", { email: loginEmail, password: loginPassword, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError("Invalid email or password.")
    } else {
      const isClinic = loginEmail.includes("researcher") || loginEmail.includes("clinic")
      router.push(isClinic ? "/clinic" : "/patient")
    }
  }

  const inputCls = "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-gray-900 text-sm transition-colors"
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide"

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-indigo-50 flex flex-col items-center justify-center px-4 py-10">
      <AnimatePresence mode="wait">

        {/* ── Role Selector ── */}
        {step === "role" && (
          <motion.div key="role" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.4 }} className="w-full max-w-lg">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-100 rounded-2xl mb-5 shadow-sm">
                <Activity className="w-8 h-8 text-rose-500" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-3">markovHealth</h1>
              <p className="text-gray-500 text-base leading-relaxed max-w-sm mx-auto">
                We screen you for clinical trials — then bring the trial <em>to you</em>. Kits by mail. Travel coordinated. Zero logistics on your end.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setStep("patient_register")}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-rose-300 rounded-2xl shadow-sm transition-all group"
              >
                <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center group-hover:bg-rose-100 transition-colors">
                  <User className="w-5 h-5 text-rose-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">I am a Patient</p>
                  <p className="text-xs text-gray-400 mt-0.5">Find trials, get matched</p>
                </div>
              </motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setStep("clinic_register")}
                className="flex flex-col items-center gap-3 p-6 bg-white border border-rose-100 hover:border-indigo-300 rounded-2xl shadow-sm transition-all group"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Map className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">I am a Clinician</p>
                  <p className="text-xs text-gray-400 mt-0.5">Upload trials, find patients</p>
                </div>
              </motion.button>
            </div>

            <button onClick={() => setStep("login")} className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-rose-600 transition-colors border border-gray-100 rounded-xl bg-white hover:border-rose-100">
              Already have an account? Sign in →
            </button>

            <div className="mt-6 space-y-2">
              <div className="bg-white rounded-2xl p-4 border border-rose-50 shadow-sm flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Zero-Knowledge Security</p>
                  <p className="text-xs text-gray-400 mt-0.5">PHI stripped before any AI sees your data.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Patient Registration ── */}
        {step === "patient_register" && (
          <motion.div key="patient_register" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-rose-100"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Patient Account</h2>
            <p className="text-gray-400 text-sm mb-6">Your story matters as much as your medical records. All data is encrypted.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={inputCls} placeholder="Sarah Jenkins" />
                </div>
                <div>
                  <label className={labelCls}>Age</label>
                  <input value={age} onChange={e => setAge(e.target.value)} type="number" className={inputCls} placeholder="52" />
                </div>
              </div>

              <div>
                <label className={labelCls}><Mail className="w-3 h-3 inline mr-1" />Email (your username)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className={inputCls} placeholder="you@example.com" />
              </div>

              <div>
                <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Phone (for coordinator contact)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={inputCls} placeholder="(555) 000-0000" />
              </div>

              <div>
                <label className={labelCls}><Home className="w-3 h-3 inline mr-1" />Full Mailing Address (for test kit shipping)</label>
                <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} placeholder="123 Elm St, Ithaca, NY 14850" />
              </div>

              <div>
                <label className={labelCls}><Lock className="w-3 h-3 inline mr-1" />My Story (encrypted before transmission)</label>
                <textarea value={story} onChange={e => setStory(e.target.value)} className={`${inputCls} h-20 resize-none`} placeholder="Briefly describe your journey..." />
              </div>

              <div>
                <label className={labelCls}>Create Password</label>
                <div className="relative">
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button disabled={loading || !email || !password || !displayName} onClick={() => handleRegister("patient")}
                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Creating account..." : <><span>Join Network (Secure)</span><ArrowRight className="w-4 h-4" /></>}
              </button>

              <button onClick={() => setStep("login")} className="w-full py-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                Already have an account? Log in
              </button>
              <button onClick={() => setStep("role")} className="w-full py-1 text-xs text-gray-300 hover:text-gray-500 transition-colors">← Back</button>
            </div>
          </motion.div>
        )}

        {/* ── Clinician Registration ── */}
        {step === "clinic_register" && (
          <motion.div key="clinic_register" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg bg-white p-8 rounded-3xl shadow-sm border border-indigo-100"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Clinician Registration</h2>
            <p className="text-gray-400 text-sm mb-6">Create your verified researcher account. All clinicians are reviewed by our team.</p>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Organization Name</label>
                <input value={orgName} onChange={e => setOrgName(e.target.value)} className={inputCls} placeholder="Memorial Sloan Kettering" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Specialty</label>
                  <input value={specialty} onChange={e => setSpecialty(e.target.value)} className={inputCls} placeholder="Oncology" />
                </div>
                <div>
                  <label className={labelCls}>NPI Number</label>
                  <input value={npi} onChange={e => setNpi(e.target.value)} className={inputCls} placeholder="1234567890" />
                </div>
              </div>

              <div>
                <label className={labelCls}><Mail className="w-3 h-3 inline mr-1" />Contact Email (shown to matched patients)</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className={inputCls} placeholder="you@hospital.org" />
              </div>

              <div>
                <label className={labelCls}><Phone className="w-3 h-3 inline mr-1" />Direct Phone (shown to matched patients)</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={inputCls} placeholder="(212) 000-0000" />
              </div>

              <div>
                <label className={labelCls}>Create Password</label>
                <div className="relative">
                  <input value={password} onChange={e => setPassword(e.target.value)} type={showPw ? "text" : "password"} className={`${inputCls} pr-10`} placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button disabled={loading || !email || !password || !orgName} onClick={() => handleRegister("researcher")}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Creating account..." : <><ShieldCheck className="w-4 h-4" /><span>Create Clinician Account</span></>}
              </button>

              <button onClick={() => setStep("login")} className="w-full py-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
                Already verified? Log in
              </button>
              <button onClick={() => setStep("role")} className="w-full py-1 text-xs text-gray-300 hover:text-gray-500">← Back</button>
            </div>
          </motion.div>
        )}

        {/* ── Login ── */}
        {step === "login" && (
          <motion.div key="login" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
          >
            <div className="flex justify-center mb-5">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1 text-center">Welcome back</h2>
            <p className="text-gray-400 text-sm mb-6 text-center">Sign in to markovHealth</p>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={`${inputCls} pr-10`} placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-2.5 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

              <button disabled={loading || !loginEmail || !loginPassword} onClick={handleLogin}
                className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <Activity className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button onClick={() => setStep("role")} className="w-full py-2 text-sm text-gray-400 hover:text-gray-700">← Back to options</button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
