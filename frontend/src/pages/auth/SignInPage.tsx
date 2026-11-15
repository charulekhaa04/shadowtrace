import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { TraceGraphSVG } from '../../components/auth/TraceGraphSVG'
import toast from 'react-hot-toast'

export default function SignInPage() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: '#080D16', color: '#E8EEF7', fontFamily: 'Inter, sans-serif' }}>
      {/* Left panel */}
      <aside className="hidden lg:flex relative w-[52%] max-w-[760px] shrink-0 flex-col justify-between overflow-hidden border-r" style={{ background: '#0B1220', borderColor: '#1A2A3F' }}>
        <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#1A2A3F 1px, transparent 1px), linear-gradient(90deg, #1A2A3F 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.4 }} />
        <div className="relative flex items-center gap-2.5 px-12 pt-10">
          <Shield className="size-8" style={{ color: '#00D6C9' }} />
          <span className="text-[15px] font-semibold tracking-[0.18em]" style={{ color: '#E8EEF7' }}>SHADOWTRACE</span>
        </div>
        <div className="relative px-12">
          <TraceGraphSVG className="w-full max-w-[560px]" />
        </div>
        <div className="relative px-12 pb-10">
          <p className="max-w-[460px] text-[30px] leading-[1.15] font-semibold tracking-tight" style={{ color: '#E8EEF7' }}>
            Every attack leaves traces.
            <span className="block" style={{ color: '#00D6C9' }}>Let AI connect them.</span>
          </p>
          <p className="mt-4 max-w-[440px] text-[14px] leading-relaxed" style={{ color: '#6B7F99' }}>
            Evidence ingestion, traffic analysis and AI-assisted correlation for incident response teams — with every finding cited back to the artifact it came from.
          </p>
        </div>
      </aside>

      {/* Right panel */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center gap-2.5 px-6 pt-6 sm:px-10 lg:hidden">
          <Shield className="size-7" style={{ color: '#00D6C9' }} />
          <span className="text-[14px] font-semibold tracking-[0.18em]">SHADOWTRACE</span>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: '#E8EEF7' }}>Sign in</h1>
              <p className="mt-2 text-[14px]" style={{ color: '#6B7F99' }}>
                Don't have an account? <Link to="/signup" className="font-medium transition-colors" style={{ color: '#00D6C9' }}>Create one</Link>
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] mb-4" style={{ borderColor: 'rgba(255,71,87,0.3)', background: 'rgba(255,71,87,0.07)', color: '#A0AEC0' }}>
                <AlertCircle className="mt-0.5 size-4 shrink-0" style={{ color: '#FF4757' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                  placeholder="analyst@organisation.com" required
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={{ background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }}
                  onFocus={e => { e.target.style.borderColor = '#00D6C9'; e.target.style.boxShadow = '0 0 0 3px rgba(0,214,201,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#243550'; e.target.style.boxShadow = 'none' }}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Password</label>
                  <Link to="/forgot-password" className="text-[13px] transition-colors" style={{ color: '#00D6C9' }}>Forgot password?</Link>
                </div>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                    placeholder="Your password" required
                    className="h-11 w-full rounded-xl border px-3.5 pr-11 text-[14px] outline-none transition-all"
                    style={{ background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }}
                    onFocus={e => { e.target.style.borderColor = '#00D6C9'; e.target.style.boxShadow = '0 0 0 3px rgba(0,214,201,0.12)' }}
                    onBlur={e => { e.target.style.borderColor = '#243550'; e.target.style.boxShadow = 'none' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg transition-colors"
                    style={{ color: '#3D5068' }}>
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold transition-all disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <><Loader2 className="size-4 animate-spin" /> Signing in…</> : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
        <div className="px-6 pb-6 text-[12px] sm:px-10" style={{ color: '#3D5068' }}>
          © 2025 Shadowtrace Security Ltd.
        </div>
      </main>
    </div>
  )
}
