import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { authApi } from '../../lib/api'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { setErrorMsg('Passwords do not match.'); return }
    if (password.length < 8) { setErrorMsg('Password must be at least 8 characters.'); return }
    setErrorMsg(''); setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setPhase('success')
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Invalid or expired reset link.')
      setPhase('error')
    } finally { setLoading(false) }
  }

  const inputStyle: React.CSSProperties = { background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }

  return (
    <div className="flex h-screen w-full items-center justify-center" style={{ background: '#080D16', fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-[400px] px-6">
        <div className="flex items-center gap-2 mb-10">
          <Shield className="size-7" style={{ color: '#00D6C9' }} />
          <span className="text-[14px] font-semibold tracking-[0.18em]" style={{ color: '#E8EEF7' }}>SHADOWTRACE</span>
        </div>

        {phase === 'success' ? (
          <div>
            <div className="mb-6 grid size-12 place-items-center rounded-2xl border" style={{ borderColor: 'rgba(0,214,201,0.35)', background: 'rgba(0,214,201,0.1)' }}>
              <CheckCircle2 className="size-5" style={{ color: '#00D6C9' }} strokeWidth={1.8} />
            </div>
            <h1 className="text-[26px] font-semibold mb-2" style={{ color: '#E8EEF7' }}>Password updated</h1>
            <p className="text-[14px] mb-6" style={{ color: '#6B7F99' }}>Your password has been changed. All other sessions have been signed out.</p>
            <Link to="/signin" className="inline-flex h-11 w-full items-center justify-center rounded-xl text-[14.5px] font-semibold"
              style={{ background: '#00D6C9', color: '#04201f' }}>Sign in with new password</Link>
          </div>
        ) : !token ? (
          <div>
            <div className="mb-6 grid size-12 place-items-center rounded-2xl border" style={{ borderColor: 'rgba(245,185,66,0.35)', background: 'rgba(245,185,66,0.1)' }}>
              <Clock className="size-5" style={{ color: '#F5B942' }} strokeWidth={1.8} />
            </div>
            <h1 className="text-[26px] font-semibold mb-2" style={{ color: '#E8EEF7' }}>Invalid link</h1>
            <p className="text-[14px] mb-6" style={{ color: '#6B7F99' }}>This reset link is missing or invalid. Request a new one.</p>
            <Link to="/forgot-password" className="inline-flex h-11 w-full items-center justify-center rounded-xl text-[14.5px] font-semibold"
              style={{ background: '#00D6C9', color: '#04201f' }}>Request new link</Link>
          </div>
        ) : (
          <div>
            <h1 className="text-[26px] font-semibold mb-2" style={{ color: '#E8EEF7' }}>Choose a new password</h1>
            <p className="text-[14px] mb-7" style={{ color: '#6B7F99' }}>Use something you haven't used on SHADOWTRACE before.</p>
            {errorMsg && <p className="text-[13px] mb-4" style={{ color: '#FF4757' }}>{errorMsg}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>New password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 12 characters"
                    className="h-11 w-full rounded-xl border px-3.5 pr-11 text-[14px] outline-none transition-all"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = '#00D6C9' }}
                    onBlur={e => { e.target.style.borderColor = '#243550' }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg" style={{ color: '#3D5068' }}>
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Confirm new password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter the new password"
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = '#00D6C9' }}
                  onBlur={e => { e.target.style.borderColor = '#243550' }} />
              </div>
              <button type="submit" disabled={loading} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <><Loader2 className="size-4 animate-spin" />Updating…</> : 'Update password'}
              </button>
            </form>
            <p className="mt-5 text-center text-[13px]">
              <Link to="/signin" style={{ color: '#00D6C9' }}>Back to sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
