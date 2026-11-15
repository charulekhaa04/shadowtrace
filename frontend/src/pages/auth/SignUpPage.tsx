import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, AlertCircle, Check } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { TraceGraphSVG } from '../../components/auth/TraceGraphSVG'
import toast from 'react-hot-toast'

const RULES = [
  { id: 'len', label: 'At least 12 characters', test: (v: string) => v.length >= 12 },
  { id: 'case', label: 'Upper and lower case', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { id: 'num', label: 'A number', test: (v: string) => /\d/.test(v) },
  { id: 'sym', label: 'A symbol', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
]

const inputStyle: React.CSSProperties = { background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }
const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#00D6C9'; e.target.style.boxShadow = '0 0 0 3px rgba(0,214,201,0.12)' },
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = '#243550'; e.target.style.boxShadow = 'none' },
}

export default function SignUpPage() {
  const navigate = useNavigate()
  const { register } = useAuthStore()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const strength = RULES.filter(r => r.test(password)).length
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength] || ''
  const strengthColor = ['', '#FF4757', '#F5B942', '#00A6C7', '#35C98A'][strength] || '#3D5068'

  const errors = {
    fullName: submitted && !fullName.trim() ? 'Full name is required.' : '',
    email: submitted && !email ? 'Email is required.' : '',
    password: submitted && strength < 3 ? 'Choose a stronger password.' : '',
    confirm: submitted && confirm !== password ? 'Passwords do not match.' : '',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!fullName.trim() || !email || strength < 3 || password !== confirm) return
    setError('')
    setLoading(true)
    try {
      await register(email, password, fullName)
      toast.success('Account created! Welcome to SHADOWTRACE.')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: '#080D16', color: '#E8EEF7', fontFamily: 'Inter, sans-serif' }}>
      <aside className="hidden lg:flex relative w-[52%] max-w-[760px] shrink-0 flex-col justify-between overflow-hidden border-r" style={{ background: '#0B1220', borderColor: '#1A2A3F' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#1A2A3F 1px, transparent 1px), linear-gradient(90deg, #1A2A3F 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.4 }} />
        <div className="relative flex items-center gap-2.5 px-12 pt-10">
          <Shield className="size-8" style={{ color: '#00D6C9' }} />
          <span className="text-[15px] font-semibold tracking-[0.18em]">SHADOWTRACE</span>
        </div>
        <div className="relative px-12"><TraceGraphSVG className="w-full max-w-[560px]" /></div>
        <div className="relative px-12 pb-10">
          <p className="max-w-[460px] text-[30px] leading-[1.15] font-semibold tracking-tight">
            Every attack leaves traces.<span className="block" style={{ color: '#00D6C9' }}>Let AI connect them.</span>
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <h1 className="text-[26px] font-semibold tracking-tight">Create account</h1>
              <p className="mt-2 text-[14px]" style={{ color: '#6B7F99' }}>
                Already have one? <Link to="/signin" style={{ color: '#00D6C9' }} className="font-medium">Sign in</Link>
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] mb-4" style={{ borderColor: 'rgba(255,71,87,0.3)', background: 'rgba(255,71,87,0.07)', color: '#A0AEC0' }}>
                <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: '#FF4757' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full name */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Full name</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" placeholder="Your full name"
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={inputStyle} {...focusHandlers} />
                {errors.fullName && <p className="text-[12.5px]" style={{ color: '#FF4757' }}>{errors.fullName}</p>}
              </div>
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="analyst@organisation.com"
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={inputStyle} {...focusHandlers} />
                {errors.email && <p className="text-[12.5px]" style={{ color: '#FF4757' }}>{errors.email}</p>}
              </div>
              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters"
                    className="h-11 w-full rounded-xl border px-3.5 pr-11 text-[14px] outline-none transition-all"
                    style={inputStyle} {...focusHandlers} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg" style={{ color: '#3D5068' }}>
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {/* Strength meter */}
                {password && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-3">
                      <div className="grid flex-1 grid-cols-4 gap-1">
                        {[1,2,3,4].map(i => (
                          <span key={i} className="h-1 rounded-full transition-colors" style={{ background: strength >= i ? strengthColor : '#243550' }} />
                        ))}
                      </div>
                      <span className="w-14 text-right text-[12px] font-medium" style={{ color: strengthColor }}>{strengthLabel}</span>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {RULES.map(r => (
                        <li key={r.id} className="flex items-center gap-1.5 text-[12px]" style={{ color: r.test(password) ? '#A0AEC0' : '#3D5068' }}>
                          <Check className="size-3 shrink-0" strokeWidth={3} style={{ color: r.test(password) ? '#00D6C9' : '#243550' }} />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {errors.password && <p className="text-[12.5px]" style={{ color: '#FF4757' }}>{errors.password}</p>}
              </div>
              {/* Confirm */}
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Confirm password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Re-enter your password"
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={inputStyle} {...focusHandlers} />
                {errors.confirm && <p className="text-[12.5px]" style={{ color: '#FF4757' }}>{errors.confirm}</p>}
              </div>

              <button type="submit" disabled={loading} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-all disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <><Loader2 className="size-4 animate-spin" />Creating account…</> : 'Create account'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
