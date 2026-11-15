import React, { useState, useEffect, useCallback } from 'react'
import { FileBarChart, Download, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { reportsApi, investigationsApi } from '../../lib/api'
import type { Investigation, ForensicReport } from '../../types'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'

function Section({ title, color, children, defaultOpen = false }: { title: string; color: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card className="p-0 overflow-hidden">
      <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#162235] transition-colors" onClick={() => setOpen(!open)}>
        <h3 className="font-semibold text-sm" style={{ color }}>{title}</h3>
        {open ? <ChevronUp className="w-4 h-4 text-[#4A5568]" /> : <ChevronDown className="w-4 h-4 text-[#4A5568]" />}
      </button>
      {open && <div className="px-6 pb-5 border-t border-[#243550]">{children}</div>}
    </Card>
  )
}

export default function ReportsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [reports, setReports] = useState<Record<string, ForensicReport>>({})
  const [generating, setGenerating] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const loadInvestigations = useCallback(async () => {
    setLoading(true)
    try {
      const r = await investigationsApi.list({ size: 100 })
      setInvestigations(r.items)
    } catch {
      toast.error('Failed to load investigations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInvestigations() }, [loadInvestigations])

  const handleGenerate = async (invId: string) => {
    setGenerating(prev => ({ ...prev, [invId]: true }))
    try {
      const report = await reportsApi.generate(invId)
      setReports(prev => ({ ...prev, [invId]: report }))
      toast.success('Forensic report generated')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate report')
    } finally {
      setGenerating(prev => ({ ...prev, [invId]: false }))
    }
  }

  const handleDownload = async (reportId: string, invTitle: string) => {
    try {
      const blob = await reportsApi.downloadPdf(reportId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shadowtrace-${invTitle.replace(/\s+/g, '-').toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF download failed')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8EEF7]">Forensic Reports</h1>
        <p className="text-sm text-[#8899AA] mt-1">
          Generate comprehensive forensic reports with MITRE ATT&CK mapping, evidence overview and risk assessments
        </p>
      </div>

      {investigations.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No investigations" description="Create an investigation first, then generate a report." />
      ) : (
        <div className="space-y-6">
          {investigations.map(inv => {
            const report = reports[inv.id]
            const isGenerating = generating[inv.id]

            return (
              <div key={inv.id} className="space-y-3">
                {/* Investigation header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#00D6C9]" />
                    <div>
                      <h2 className="font-semibold text-[#E8EEF7]">{inv.title}</h2>
                      <p className="text-xs text-[#4A5568]">ID: {inv.id.slice(0, 8)} · {inv.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {report && (
                      <button
                        onClick={() => handleDownload(report.id, inv.title)}
                        className="flex items-center gap-2 px-3 py-2 bg-[#162235] hover:bg-[#1E2F45] border border-[#243550] text-[#E8EEF7] rounded-lg text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" /> PDF
                      </button>
                    )}
                    <button
                      onClick={() => handleGenerate(inv.id)}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-4 py-2 bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {isGenerating ? <LoadingSpinner size="sm" /> : <FileBarChart className="w-4 h-4" />}
                      {report ? 'Regenerate' : 'Generate Report'}
                    </button>
                  </div>
                </div>

                {report && (
                  <div className="space-y-3 pl-8">
                    {/* Executive summary */}
                    {report.report_data?.executive_summary && (
                      <Section title="Executive Summary" color="#00D6C9" defaultOpen>
                        <p className="text-sm text-[#8899AA] leading-relaxed mt-4">{report.report_data.executive_summary}</p>
                      </Section>
                    )}

                    {/* Risk assessment */}
                    {report.report_data?.risk_assessment && (
                      <Section title="Risk Assessment" color="#F5B942">
                        <div className="mt-4 space-y-3">
                          {Object.entries(report.report_data.risk_assessment).map(([k, v]) => (
                            <div key={k} className="flex justify-between items-center text-sm">
                              <span className="text-[#8899AA] capitalize">{k.replace(/_/g, ' ')}</span>
                              <Badge variant={String(v).toLowerCase() === 'critical' ? 'danger' : String(v).toLowerCase() === 'high' ? 'warning' : 'default'}>
                                {String(v)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Findings */}
                    {report.report_data?.findings && report.report_data.findings.length > 0 && (
                      <Section title={`Threat Findings (${report.report_data.findings.length})`} color="#FF4757">
                        <div className="mt-4 space-y-2">
                          {report.report_data.findings.map((f: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#162235]">
                              <AlertTriangle className="w-4 h-4 text-[#F5B942] mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-[#E8EEF7]">{f.title || f.finding}</p>
                                {f.description && <p className="text-xs text-[#8899AA] mt-1">{f.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* MITRE ATT&CK */}
                    {report.report_data?.mitre_techniques && report.report_data.mitre_techniques.length > 0 && (
                      <Section title="MITRE ATT&CK Mapping" color="#00A6C7">
                        <div className="mt-4 flex flex-wrap gap-2">
                          {report.report_data.mitre_techniques.map((t: any, i: number) => (
                            <div key={i} className="px-3 py-2 rounded-lg bg-[#162235] border border-[#243550]">
                              <p className="text-xs font-mono text-[#00A6C7]">{t.technique_id}</p>
                              <p className="text-xs text-[#E8EEF7] mt-0.5">{t.name}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* Recommendations */}
                    {report.report_data?.recommendations && report.report_data.recommendations.length > 0 && (
                      <Section title="Defensive Recommendations" color="#35C98A">
                        <ul className="mt-4 space-y-2">
                          {report.report_data.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[#8899AA]">
                              <CheckCircle className="w-4 h-4 text-[#35C98A] mt-0.5 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </Section>
                    )}

                    <p className="text-xs text-[#4A5568] flex items-center gap-1.5 pl-1">
                      <Shield className="w-3 h-3" />
                      Report generated {new Date(report.created_at).toLocaleString()} · AI-assisted analysis
                    </p>
                  </div>
                )}

                {!report && !isGenerating && (
                  <div className="pl-8">
                    <p className="text-xs text-[#4A5568]">No report generated yet for this investigation.</p>
                  </div>
                )}

                <div className="border-b border-[#1A2740]" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
