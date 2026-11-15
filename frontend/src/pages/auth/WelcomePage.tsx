import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Zap, Search, BarChart3, Bot, FileText } from 'lucide-react'
import { TraceGraphSVG } from '../../components/auth/TraceGraphSVG'

const features = [
  { icon: Search, label: 'URL & IP Scanner', desc: 'Instant threat intelligence' },
  { icon: BarChart3, label: 'Network ML Analysis', desc: 'CIC-IDS2017 trained models' },
  { icon: Bot, label: 'AI Investigation Chat', desc: 'RAG-grounded responses' },
  { icon: FileText, label: 'Forensic Reports', desc: 'PDF export with MITRE mapping' },
]

export default function WelcomePage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#080D16', fontFamily: 'Inter, sans-serif', color: '#E8EEF7' }}>
      {/* Left hero */}
      <div className="flex flex-col justify-between flex-1 p-10 lg:p-16" style={{ background: '#0B1220', borderRight: '1px solid #1A2A3F', position: 'relative', overflow: 'hidden' }}>
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(#1A2A3F 1px, transparent 1px), linear-gradient(90deg, #1A2A3F 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <Shield className="size-9" style={{ color: '#00D6C9' }} />
            <span className="text-[16px] font-bold tracking-[0.2em]" style={{ color: '#E8EEF7' }}>SHADOWTRACE</span>
          </div>
          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.1] tracking-tight mb-6 max-w-xl">
            Every attack<br />leaves <span style={{ color: '#00D6C9' }}>traces.</span>
          </h1>
          <p className="text-[17px] leading-relaxed max-w-md mb-10" style={{ color: '#6B7F99' }}>
            AI-powered digital forensics platform. Submit suspicious indicators, upload evidence, run ML analysis, correlate findings and generate forensic reports — all in one workspace.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl p-4" style={{ background: '#162235', border: '1px solid #1A2A3F' }}>
                <Icon className="size-5 mt-0.5 shrink-0" style={{ color: '#00D6C9' }} />
                <div>
                  <div className="text-[13px] font-semibold">{label}</div>
                  <div className="text-[12px]" style={{ color: '#6B7F99' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-10">
          <TraceGraphSVG className="w-full max-w-[520px]" />
        </div>
      </div>

      {/* Right CTA */}
      <div className="flex flex-col items-center justify-center p-10 lg:w-[42%] lg:max-w-[560px]">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium mb-6" style={{ background: 'rgba(0,214,201,0.1)', border: '1px solid rgba(0,214,201,0.3)', color: '#00D6C9' }}>
              <Zap className="size-3.5" /> Intelligence. Evidence. Investigation.
            </div>
            <h2 className="text-[28px] font-bold tracking-tight mb-3">Start investigating</h2>
            <p className="text-[14px]" style={{ color: '#6B7F99' }}>Create a free account to access all investigation tools.</p>
          </div>

          <div className="space-y-3">
            <button onClick={() => navigate('/signup')} className="w-full h-12 rounded-xl text-[15px] font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: '#00D6C9', color: '#04201f' }}>
              Create free account
            </button>
            <button onClick={() => navigate('/signin')} className="w-full h-12 rounded-xl text-[15px] font-medium transition-all hover:opacity-80"
              style={{ background: '#162235', border: '1px solid #243550', color: '#E8EEF7' }}>
              Sign in to existing account
            </button>
          </div>

          <div className="mt-10 pt-8 border-t text-center text-[12px]" style={{ borderColor: '#1A2A3F', color: '#3D5068' }}>
            <p className="mb-2">Chain of custody preserved · SHA-256 hashed at ingest</p>
            <p>AI inferences are clearly distinguished from confirmed evidence</p>
          </div>
        </div>
      </div>
    </div>
  )
}
