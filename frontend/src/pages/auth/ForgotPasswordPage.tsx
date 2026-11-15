import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { authApi } from '../../lib/api'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    try {
      await authApi.forgotPassword(email)
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center" style={{ background: '#080D16', fontFamily: 'Inter, sans-serif' }}>
      <div className="w-full max-w-[400px] px-6">
        <div className="flex items-center gap-2 mb-10">
          <Shield className="size-7" style={{ color: '#00D6C9' }} />
          <span className="text-[14px] font-semibold tracking-[0.18em]" style={{ color: '#E8EEF7' }}>SHADOWTRACE</span>
        </div>

        {sent ? (
          <div>
            <div className="mb-6 grid size-12 place-items-center rounded-2xl border" style={{ borderColor: 'rgba(0,214,201,0.35)', background: 'rgba(0,214,201,0.1)' }}>
              <CheckCircle2 className="size-5" style={{ color: '#00D6C9' }} strokeWidth={1.8} />
            </div>
            <h1 className="text-[26px] font-semibold tracking-tight mb-2" style={{ color: '#E8EEF7' }}>Check your email</h1>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: '#6B7F99' }}>
              If <strong style={{ color: '#E8EEF7' }}>{email}</strong> is registered, a reset link has been sent. Check your inbox and spam folder.
            </p>
            <Link to="/signin" className="inline-flex h-11 w-full items-center justify-center rounded-xl text-[14.5px] font-semibold"
              style={{ background: '#00D6C9', color: '#04201f' }}>Back to sign in</Link>
          </div>
        ) : (
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight mb-2" style={{ color: '#E8EEF7' }}>Reset your password</h1>
            <p className="text-[14px] leading-relaxed mb-7" style={{ color: '#6B7F99' }}>Enter your email and we'll send a reset link.</p>
            {error && (
              <div className="flex items-center gap-2 rounded-xl border px-3.5 py-3 text-[13px] mb-4" style={{ borderColor: 'rgba(255,71,87,0.3)', background: 'rgba(255,71,87,0.07)', color: '#A0AEC0' }}>
                <AlertCircle className="size-4 shrink-0" style={{ color: '#FF4757' }} />{error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="analyst@organisation.com"
                  className="h-11 w-full rounded-xl border px-3.5 text-[14px] outline-none transition-all"
                  style={{ background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }}
                  onFocus={e => { e.target.style.borderColor = '#00D6C9'; e.target.style.boxShadow = '0 0 0 3px rgba(0,214,201,0.12)' }}
                  onBlur={e => { e.target.style.borderColor = '#243550'; e.target.style.boxShadow = 'none' }} />
              </div>
              <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14.5px] font-semibold disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <><Loader2 className="size-4 animate-spin" />Sending…</> : 'Send reset link'}
              </button>
            </form>
            <p className="mt-5 text-center text-[13px]" style={{ color: '#6B7F99' }}>
              <Link to="/signin" style={{ color: '#00D6C9' }} className="font-medium">Back to sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
