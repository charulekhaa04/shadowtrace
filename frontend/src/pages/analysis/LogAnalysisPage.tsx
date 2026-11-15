import React, { useState } from 'react'
import { FileText, AlertTriangle, Shield, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { analysisApi, investigationsApi } from '../../lib/api'
import type { LogAnalysisResult, Investigation } from '../../types'
import Card from '../../components/ui/Card'
import FileUpload from '../../components/ui/FileUpload'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#FF4757',
  high: '#FF6B81',
  medium: '#F5B942',
  low: '#00D6C9',
  info: '#8899AA',
}

export default function LogAnalysisPage() {
  const [result, setResult] = useState<LogAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInv, setSelectedInv] = useState('')
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null)

  React.useEffect(() => {
    investigationsApi.list({ size: 100 }).then(r => setInvestigations(r.items)).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    setLoading(true)
    setProgress(0)
    setResult(null)
    try {
      const res = await analysisApi.analyzeLogs(file, selectedInv || undefined, setProgress)
      setResult(res)
      toast.success('Log analysis complete')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Log analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const severityData = result
    ? Object.entries(result.severity_breakdown || {}).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8EEF7]">System Log Analysis</h1>
        <p className="text-sm text-[#8899AA] mt-1">
          Upload TXT, LOG, JSON or CSV files — NLP and rule-based detection extracts security events and IOCs
        </p>
      </div>

      {/* Upload */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5 text-[#00D6C9]" />
          <h2 className="font-semibold text-[#E8EEF7]">Upload Log File</h2>
        </div>
        <div className="mb-2">
          <label className="block text-xs text-[#8899AA] mb-1">Link to Investigation (optional)</label>
          <select
            value={selectedInv}
            onChange={e => setSelectedInv(e.target.value)}
            className="bg-[#162235] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">— None —</option>
            {investigations.map(inv => <option key={inv.id} value={inv.id}>{inv.title}</option>)}
          </select>
        </div>
        <FileUpload
          accept=".txt,.log,.json,.csv"
          maxSize={100}
          onFile={handleFile}
          progress={loading ? progress : undefined}
          label="Drop log file here or click to upload"
          sublabel="Syslog, auth.log, Windows Event Log (JSON), CSV — max 100 MB"
        />
        {loading && (
          <div className="flex items-center gap-3 text-sm text-[#8899AA]">
            <LoadingSpinner size="sm" />
            <span>Analysing log entries… {progress}%</span>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Events', value: result.total_events, color: '#00D6C9' },
              { label: 'Findings', value: result.findings?.length || 0, color: '#FF4757' },
              { label: 'IOCs Extracted', value: result.indicators?.length || 0, color: '#F5B942' },
              { label: 'Suspicious Lines', value: result.suspicious_count || 0, color: '#FF6B81' },
            ].map(s => (
              <Card key={s.label} className="p-5">
                <p className="text-xs text-[#8899AA]">{s.label}</p>
                <p className="text-2xl font-bold font-mono mt-1" style={{ color: s.color }}>{s.value}</p>
              </Card>
            ))}
          </div>

          {/* Severity breakdown pie */}
          {severityData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h2 className="font-semibold text-[#E8EEF7] mb-4">Severity Breakdown</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {severityData.map((entry, i) => (
                        <Cell key={i} fill={SEVERITY_COLORS[entry.name.toLowerCase()] || '#8899AA'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111B2B', border: '1px solid #243550', borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>

              {/* Summary text */}
              {result.summary && (
                <Card className="p-6">
                  <h2 className="font-semibold text-[#E8EEF7] mb-3">Analysis Summary</h2>
                  <p className="text-sm text-[#8899AA] leading-relaxed">{result.summary}</p>
                </Card>
              )}
            </div>
          )}

          {/* Findings list */}
          {result.findings && result.findings.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#243550]">
                <h2 className="font-semibold text-[#E8EEF7]">Security Findings ({result.findings.length})</h2>
              </div>
              <div className="divide-y divide-[#1A2740]">
                {result.findings.map((f: any, i: number) => (
                  <div key={i} className="px-6 py-4 hover:bg-[#162235] transition-colors cursor-pointer" onClick={() => setExpandedFinding(expandedFinding === i ? null : i)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[f.severity] || '#8899AA' }} />
                        <span className="text-sm font-medium text-[#E8EEF7]">{f.title || f.rule}</span>
                        <Badge variant={f.severity === 'critical' || f.severity === 'high' ? 'danger' : f.severity === 'medium' ? 'warning' : 'default'}>
                          {f.severity}
                        </Badge>
                      </div>
                      {expandedFinding === i ? <ChevronUp className="w-4 h-4 text-[#4A5568]" /> : <ChevronDown className="w-4 h-4 text-[#4A5568]" />}
                    </div>
                    {expandedFinding === i && (
                      <div className="mt-3 pl-5 space-y-2">
                        {f.description && <p className="text-sm text-[#8899AA]">{f.description}</p>}
                        {f.timestamp && <p className="text-xs font-mono text-[#4A5568]">Time: {f.timestamp}</p>}
                        {f.line_number && <p className="text-xs font-mono text-[#4A5568]">Line: {f.line_number}</p>}
                        {f.raw_line && (
                          <div className="bg-[#0B1220] rounded-lg p-3 font-mono text-xs text-[#00D6C9] overflow-x-auto">
                            {f.raw_line}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Indicators / IOCs */}
          {result.indicators && result.indicators.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#243550]">
                <h2 className="font-semibold text-[#E8EEF7]">Extracted Indicators ({result.indicators.length})</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#243550] text-[#8899AA]">
                    <th className="px-6 py-3 text-left font-medium">Type</th>
                    <th className="px-6 py-3 text-left font-medium">Value</th>
                    <th className="px-6 py-3 text-left font-medium">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2740]">
                  {result.indicators.map((ind: any, i: number) => (
                    <tr key={i} className="hover:bg-[#162235] transition-colors">
                      <td className="px-6 py-3">
                        <Badge variant="info" className="text-xs uppercase">{ind.type}</Badge>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[#00D6C9]">{ind.value}</td>
                      <td className="px-6 py-3 text-xs text-[#8899AA] truncate max-w-[300px]">{ind.context || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="text-xs text-[#4A5568] flex items-center gap-2 px-1">
            <Shield className="w-3 h-3" />
            Log analysis uses rule-based detection and NLP pattern matching. Results are indicative — not confirmed forensic evidence.
          </div>
        </>
      )}
    </div>
  )
}
