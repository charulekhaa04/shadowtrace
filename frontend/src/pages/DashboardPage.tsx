import React, { useEffect, useState } from 'react'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Shield, AlertTriangle, Eye, Database, TrendingUp, Clock, ExternalLink } from 'lucide-react'
import { dashboardApi } from '../lib/api'
import { Link } from 'react-router-dom'
import { cn, formatDate, getRiskColor } from '../lib/utils'

const COLORS = { critical: '#FF4757', high: '#FF8C00', medium: '#F5B942', low: '#00A6C7', safe: '#35C98A' }
const PIE_COLORS = ['#FF4757', '#F5B942', '#00D6C9', '#00A6C7', '#35C98A']

// Generate mock 30-day threat activity for chart
function generateActivity() {
  const data = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    data.push({
      date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      critical: Math.floor(Math.random() * 4),
      high: Math.floor(Math.random() * 8),
      medium: Math.floor(Math.random() * 15),
    })
  }
  return data
}

const ACTIVITY = generateActivity()

const STAT_CARDS = [
  { key: 'total_investigations', label: 'Total Investigations', icon: Shield, color: '#00D6C9', path: '/investigations' },
  { key: 'critical_threats', label: 'Critical Threats', icon: AlertTriangle, color: '#FF4757', path: '/scanner' },
  { key: 'suspicious_indicators', label: 'Suspicious Indicators', icon: Eye, color: '#F5B942', path: '/scanner' },
  { key: 'evidence_count', label: 'Evidence Files', icon: Database, color: '#00A6C7', path: '/evidence' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const threatDist = stats?.threat_distribution
    ? Object.entries(stats.threat_distribution).map(([k, v], i) => ({ name: k.toUpperCase(), value: v as number, color: PIE_COLORS[i % PIE_COLORS.length] }))
    : [{ name: 'URL', value: 1, color: '#00D6C9' }]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#E8EEF7' }}>Security Dashboard</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7F99' }}>Overview of your investigation activity and threat landscape.</p>
        </div>
        <Link to="/investigations" className="inline-flex items-center gap-2 rounded-xl px-4 h-9 text-[13px] font-medium transition-all hover:opacity-80"
          style={{ background: '#00D6C9', color: '#04201f' }}>
          <Shield className="size-4" /> New Investigation
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color, path }) => (
          <Link to={path} key={key} className="rounded-2xl p-5 transition-all hover:scale-[1.01]" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="rounded-xl p-2.5" style={{ background: `${color}18` }}>
                <Icon className="size-5" style={{ color }} />
              </div>
              <TrendingUp className="size-4" style={{ color: '#3D5068' }} />
            </div>
            <div className="text-[32px] font-bold leading-none mb-1" style={{ color: '#E8EEF7' }}>
              {loading ? '—' : stats?.[key] ?? 0}
            </div>
            <div className="text-[13px]" style={{ color: '#6B7F99' }}>{label}</div>
          </Link>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Threat Activity */}
        <div className="xl:col-span-2 rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: '#E8EEF7' }}>Threat Activity — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ACTIVITY}>
              <defs>
                {(['critical', 'high', 'medium'] as const).map(k => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[k]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS[k]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A2A3F" />
              <XAxis dataKey="date" tick={{ fill: '#6B7F99', fontSize: 11 }} tickLine={false} axisLine={false} interval={6} />
              <YAxis tick={{ fill: '#6B7F99', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: '#162235', border: '1px solid #243550', borderRadius: 12, color: '#E8EEF7', fontSize: 12 }} />
              <Area type="monotone" dataKey="critical" stroke="#FF4757" fill="url(#grad-critical)" strokeWidth={2} />
              <Area type="monotone" dataKey="high" stroke="#FF8C00" fill="url(#grad-high)" strokeWidth={2} />
              <Area type="monotone" dataKey="medium" stroke="#F5B942" fill="url(#grad-medium)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Threat Distribution */}
        <div className="rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
          <h2 className="text-[14px] font-semibold mb-4" style={{ color: '#E8EEF7' }}>Scan Distribution</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={threatDist} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {threatDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#162235', border: '1px solid #243550', borderRadius: 12, color: '#E8EEF7', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {threatDist.map(item => (
              <div key={item.name} className="flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: item.color }} />
                  <span style={{ color: '#A0AEC0' }}>{item.name}</span>
                </div>
                <span style={{ color: '#E8EEF7' }} className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Investigations + Recent Scans */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold" style={{ color: '#E8EEF7' }}>Recent Investigations</h2>
            <Link to="/investigations" className="text-[12px]" style={{ color: '#00D6C9' }}>View all →</Link>
          </div>
          {loading ? (
            <div className="text-[13px] text-center py-8" style={{ color: '#6B7F99' }}>Loading…</div>
          ) : stats?.recent_investigations?.length ? (
            <div className="space-y-2">
              {stats.recent_investigations.map((inv: any) => (
                <Link to={`/investigations/${inv.id}`} key={inv.id}
                  className="flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-opacity-50"
                  style={{ background: '#162235', border: '1px solid #1A2A3F' }}>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: '#E8EEF7' }}>{inv.title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: '#6B7F99' }}>{inv.evidence_count} evidence files · {formatDate(inv.created_at)}</div>
                  </div>
                  <span className="text-[11px] rounded-full px-2.5 py-1 font-medium capitalize" style={{
                    background: inv.status === 'open' ? 'rgba(0,214,201,0.15)' : 'rgba(53,201,138,0.15)',
                    color: inv.status === 'open' ? '#00D6C9' : '#35C98A'
                  }}>{inv.status}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Shield className="size-10 mx-auto mb-3" style={{ color: '#1A2A3F' }} />
              <p className="text-[13px]" style={{ color: '#6B7F99' }}>No investigations yet.</p>
              <Link to="/investigations" className="text-[13px] font-medium mt-1 inline-block" style={{ color: '#00D6C9' }}>Create your first →</Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5" style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold" style={{ color: '#E8EEF7' }}>Recent Scans</h2>
            <Link to="/scanner" className="text-[12px]" style={{ color: '#00D6C9' }}>New scan →</Link>
          </div>
          {loading ? (
            <div className="text-[13px] text-center py-8" style={{ color: '#6B7F99' }}>Loading…</div>
          ) : stats?.recent_scans?.length ? (
            <div className="space-y-2">
              {stats.recent_scans.map((scan: any) => (
                <div key={scan.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#162235', border: '1px solid #1A2A3F' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] uppercase font-bold rounded px-1.5 py-0.5 shrink-0"
                        style={{ background: '#243550', color: '#00D6C9', fontFamily: 'JetBrains Mono, monospace' }}>{scan.scan_type}</span>
                      <span className="text-[12px] truncate" style={{ color: '#E8EEF7', fontFamily: 'JetBrains Mono, monospace' }}>{scan.target}</span>
                    </div>
                    <div className="text-[11px]" style={{ color: '#6B7F99' }}>{formatDate(scan.created_at)}</div>
                  </div>
                  <span className="ml-3 shrink-0 text-[11px] rounded-full px-2.5 py-1 font-medium capitalize"
                    style={{ background: `${getRiskColor(scan.risk_level)}20`, color: getRiskColor(scan.risk_level) }}>
                    {scan.risk_level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="size-10 mx-auto mb-3" style={{ color: '#1A2A3F' }} />
              <p className="text-[13px]" style={{ color: '#6B7F99' }}>No scans yet.</p>
              <Link to="/scanner" className="text-[13px] font-medium mt-1 inline-block" style={{ color: '#00D6C9' }}>Run your first scan →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
