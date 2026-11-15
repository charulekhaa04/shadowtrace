import React, { useState, useRef } from 'react'
import { Scan, Globe, Mail, Wifi, Loader2, AlertTriangle, CheckCircle, AlertCircle, Info, Shield, ExternalLink } from 'lucide-react'
import { scannerApi } from '../../lib/api'
import { getRiskColor } from '../../lib/utils'
import toast from 'react-hot-toast'

type ScanTab = 'url' | 'email' | 'ip'

function RiskGauge({ score, level }: { score: number; level: string }) {
  const color = getRiskColor(level)
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl" style={{ background: '#162235', border: `1px solid ${color}40` }}>
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#1A2A3F" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(score / 100) * 201} 201`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[20px] font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <div>
        <div className="text-[11px] uppercase font-semibold mb-1" style={{ color: '#6B7F99', letterSpacing: '0.08em' }}>Risk Score</div>
        <div className="text-[22px] font-bold capitalize" style={{ color }}>{level}</div>
        <div className="text-[12px] mt-1" style={{ color: '#6B7F99' }}>out of 100</div>
      </div>
    </div>
  )
}

function FindingItem({ finding }: { finding: any }) {
  const sevColor = getRiskColor(finding.severity)
  const SevIcon = finding.severity === 'critical' || finding.severity === 'high' ? AlertTriangle :
    finding.severity === 'medium' ? AlertCircle : Info
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: '#162235', border: '1px solid #1A2A3F' }}>
      <SevIcon className="size-4 mt-0.5 shrink-0" style={{ color: sevColor }} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase" style={{ color: sevColor }}>{finding.severity}</span>
          <span className="text-[11px] font-medium" style={{ color: '#A0AEC0' }}>{finding.type?.replace(/_/g, ' ')}</span>
          {finding.source && <span className="text-[10px] rounded px-1.5 py-0.5" style={{ background: '#243550', color: '#6B7F99' }}>{finding.source}</span>}
        </div>
        <p className="text-[12px] leading-relaxed" style={{ color: '#6B7F99' }}>{finding.description}</p>
      </div>
    </div>
  )
}

export default function ThreatScannerPage() {
  const [tab, setTab] = useState<ScanTab>('url')
  const [urlInput, setUrlInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [ipInput, setIpInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const TABS = [
    { id: 'url' as ScanTab, label: 'URL Scanner', icon: Globe },
    { id: 'email' as ScanTab, label: 'Email Scanner', icon: Mail },
    { id: 'ip' as ScanTab, label: 'IP Scanner', icon: Wifi },
  ]

  const scan = async () => {
    setResult(null)
    setLoading(true)
    try {
      let res
      if (tab === 'url') {
        if (!urlInput.trim()) { toast.error('Enter a URL to scan.'); setLoading(false); return }
        res = await scannerApi.scanUrl(urlInput.trim())
      } else if (tab === 'email') {
        if (!emailInput.trim()) { toast.error('Enter an email address.'); setLoading(false); return }
        res = await scannerApi.scanEmail(emailInput.trim(), emailContent || undefined)
      } else {
        if (!ipInput.trim()) { toast.error('Enter an IP address.'); setLoading(false); return }
        res = await scannerApi.scanIp(ipInput.trim())
      }
      setResult(res)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Scan failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const findings = result?.findings ?? result?.raw_results?.findings ?? []
  const geo = result?.raw_results?.geolocation

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold" style={{ color: '#E8EEF7' }}>Threat Scanner</h1>
        <p className="text-[13px] mt-1" style={{ color: '#6B7F99' }}>Analyse URLs, email addresses and IP addresses against threat intelligence.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 w-fit" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); setResult(null) }}
            className="flex items-center gap-2 px-4 h-9 rounded-lg text-[13px] font-medium transition-all"
            style={{ background: tab === id ? '#162235' : 'transparent', color: tab === id ? '#00D6C9' : '#6B7F99', border: tab === id ? '1px solid #243550' : '1px solid transparent' }}>
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
        {tab === 'url' && (
          <div className="space-y-3">
            <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>URL to analyse</label>
            <div className="flex gap-3">
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && scan()}
                placeholder="https://suspicious-domain.example.com/login" className="flex-1 h-11 rounded-xl border px-4 text-[14px] outline-none font-mono"
                style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7', fontFamily: 'JetBrains Mono, monospace' }}
                onFocus={e => e.target.style.borderColor = '#00D6C9'}
                onBlur={e => e.target.style.borderColor = '#243550'} />
              <button onClick={scan} disabled={loading} className="h-11 px-6 rounded-xl text-[13px] font-semibold flex items-center gap-2 disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Scan className="size-4" />}
                {loading ? 'Scanning…' : 'Scan'}
              </button>
            </div>
          </div>
        )}

        {tab === 'email' && (
          <div className="space-y-3">
            <div>
              <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#A0AEC0' }}>Email address</label>
              <div className="flex gap-3">
                <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="suspicious@unknown-domain.xyz"
                  className="flex-1 h-11 rounded-xl border px-4 text-[14px] outline-none font-mono"
                  style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7', fontFamily: 'JetBrains Mono, monospace' }}
                  onFocus={e => e.target.style.borderColor = '#00D6C9'}
                  onBlur={e => e.target.style.borderColor = '#243550'} />
                <button onClick={scan} disabled={loading} className="h-11 px-6 rounded-xl text-[13px] font-semibold flex items-center gap-2 disabled:opacity-70"
                  style={{ background: '#00D6C9', color: '#04201f' }}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Scan className="size-4" />}
                  {loading ? 'Scanning…' : 'Scan'}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[13px] font-medium block mb-1.5" style={{ color: '#A0AEC0' }}>Email content (optional)</label>
              <textarea value={emailContent} onChange={e => setEmailContent(e.target.value)} rows={4} placeholder="Paste the email body here for deeper phishing analysis…"
                className="w-full rounded-xl border px-4 py-3 text-[13px] outline-none resize-none"
                style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7' }}
                onFocus={e => e.target.style.borderColor = '#00D6C9'}
                onBlur={e => e.target.style.borderColor = '#243550'} />
            </div>
          </div>
        )}

        {tab === 'ip' && (
          <div className="space-y-3">
            <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>IP address to investigate</label>
            <div className="flex gap-3">
              <input value={ipInput} onChange={e => setIpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && scan()}
                placeholder="192.0.2.1" className="flex-1 h-11 rounded-xl border px-4 text-[14px] outline-none font-mono"
                style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7', fontFamily: 'JetBrains Mono, monospace' }}
                onFocus={e => e.target.style.borderColor = '#00D6C9'}
                onBlur={e => e.target.style.borderColor = '#243550'} />
              <button onClick={scan} disabled={loading} className="h-11 px-6 rounded-xl text-[13px] font-semibold flex items-center gap-2 disabled:opacity-70"
                style={{ background: '#00D6C9', color: '#04201f' }}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Scan className="size-4" />}
                {loading ? 'Scanning…' : 'Scan'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <RiskGauge score={Math.round(result.risk_score ?? 0)} level={result.risk_level ?? 'safe'} />

          {/* Geo info for IP */}
          {geo && geo.country && (
            <div className="rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: '#E8EEF7' }}>Geolocation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                {[['Country', geo.country], ['City', geo.city], ['ISP', geo.isp], ['ASN', geo.as]].map(([k, v]) => (
                  <div key={k}><div style={{ color: '#6B7F99' }}>{k}</div><div className="font-medium mt-0.5" style={{ color: '#E8EEF7' }}>{v || '—'}</div></div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {findings.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: '#E8EEF7' }}>{findings.length} Findings</h3>
              <div className="space-y-2">
                {findings.map((f: any, i: number) => <FindingItem key={i} finding={f} />)}
              </div>
            </div>
          )}

          {findings.length === 0 && result.risk_level === 'safe' && (
            <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: 'rgba(53,201,138,0.08)', border: '1px solid rgba(53,201,138,0.3)' }}>
              <CheckCircle className="size-6 shrink-0" style={{ color: '#35C98A' }} />
              <div>
                <div className="text-[14px] font-medium" style={{ color: '#35C98A' }}>No threats detected</div>
                <div className="text-[12px] mt-0.5" style={{ color: '#6B7F99' }}>This target appears clean based on the checks performed.</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
