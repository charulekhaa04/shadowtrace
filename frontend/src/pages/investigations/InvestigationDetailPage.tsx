import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Shield, FileText, Network, Clock, MessageSquare,
  BarChart3, Upload, Trash2, Download, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Clock3, Eye, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { investigationsApi, evidenceApi, reportsApi, aiApi } from '../../lib/api'
import type { Investigation, Evidence, ForensicReport, ChatMessage } from '../../types'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import FileUpload from '../../components/ui/FileUpload'
import EmptyState from '../../components/ui/EmptyState'

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'evidence', label: 'Evidence', icon: FileText },
  { id: 'report', label: 'Report', icon: BarChart3 },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
] as const

type Tab = typeof TABS[number]['id']

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle className="w-4 h-4 text-[#35C98A]" />
  if (status === 'active') return <Clock3 className="w-4 h-4 text-[#00D6C9]" />
  if (status === 'critical') return <AlertTriangle className="w-4 h-4 text-[#FF4757]" />
  return <Clock3 className="w-4 h-4 text-[#F5B942]" />
}

export default function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [report, setReport] = useState<ForensicReport | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await investigationsApi.get(id)
      setInvestigation(inv)
      const evResp = await evidenceApi.list({ investigation_id: id })
      setEvidence(evResp.items)
    } catch {
      toast.error('Failed to load investigation')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    if (!id) return
    setUploading(true)
    setUploadProgress(0)
    try {
      const ev = await evidenceApi.upload(file, id, setUploadProgress)
      setEvidence(prev => [ev, ...prev])
      toast.success('Evidence uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteEvidence = async (evId: string) => {
    try {
      await evidenceApi.delete(evId)
      setEvidence(prev => prev.filter(e => e.id !== evId))
      toast.success('Evidence removed')
    } catch {
      toast.error('Failed to delete evidence')
    }
  }

  const handleGenerateReport = async () => {
    if (!id) return
    setGenerating(true)
    try {
      const r = await reportsApi.generate(id)
      setReport(r)
      toast.success('Report generated')
      setTab('report')
    } catch {
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!report) return
    try {
      const blob = await reportsApi.downloadPdf(report.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `shadowtrace-report-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF download failed')
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || !id) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      created_at: new Date().toISOString(),
    }
    setChatMessages(prev => [...prev, userMsg])
    const q = chatInput
    setChatInput('')
    setChatLoading(true)
    try {
      const resp = await aiApi.chat(q, id)
      setChatMessages(prev => [...prev, resp])
    } catch {
      toast.error('Chat request failed')
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  )

  if (!investigation) return (
    <EmptyState icon={Shield} title="Investigation not found" description="This investigation does not exist or you don't have access to it." />
  )

  const statusColors: Record<string, string> = {
    active: 'info',
    completed: 'success',
    critical: 'danger',
    pending: 'warning',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/investigations')} className="mt-1 p-1 rounded text-[#8899AA] hover:text-[#E8EEF7] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF7]">{investigation.title}</h1>
            {investigation.description && (
              <p className="mt-1 text-sm text-[#8899AA]">{investigation.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusColors[investigation.status] as any || 'default'}>
                {statusIcon(investigation.status)}
                <span className="ml-1 capitalize">{investigation.status}</span>
              </Badge>
              <span className="text-xs text-[#4A5568]">ID: {investigation.id.slice(0, 8)}</span>
              <span className="text-xs text-[#4A5568]">
                Created {new Date(investigation.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-[#243550] text-[#8899AA] hover:text-[#E8EEF7] hover:bg-[#162235] transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? <LoadingSpinner size="sm" /> : <BarChart3 className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#243550]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[#00D6C9] text-[#00D6C9]'
                : 'border-transparent text-[#8899AA] hover:text-[#E8EEF7]'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="col-span-2 p-6 space-y-4">
            <h2 className="font-semibold text-[#E8EEF7]">Investigation Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#8899AA]">Status</span>
                <Badge variant={statusColors[investigation.status] as any || 'default'} className="capitalize">{investigation.status}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8899AA]">Evidence Count</span>
                <span className="text-[#E8EEF7] font-mono">{evidence.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8899AA]">Created</span>
                <span className="text-[#E8EEF7]">{new Date(investigation.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8899AA]">Last Updated</span>
                <span className="text-[#E8EEF7]">{new Date(investigation.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold text-[#E8EEF7] mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => setTab('evidence')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#162235] hover:bg-[#1E2F45] text-sm text-[#E8EEF7] transition-colors">
                <Upload className="w-4 h-4 text-[#00D6C9]" /> Upload Evidence
              </button>
              <button onClick={() => setTab('chat')} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#162235] hover:bg-[#1E2F45] text-sm text-[#E8EEF7] transition-colors">
                <MessageSquare className="w-4 h-4 text-[#00D6C9]" /> Ask AI Assistant
              </button>
              <button onClick={handleGenerateReport} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#162235] hover:bg-[#1E2F45] text-sm text-[#E8EEF7] transition-colors">
                <BarChart3 className="w-4 h-4 text-[#00D6C9]" /> Generate Report
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Evidence Tab */}
      {tab === 'evidence' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-semibold text-[#E8EEF7] mb-4">Upload Evidence</h2>
            <FileUpload
              accept=".txt,.log,.csv,.json,.pcap,.pcapng,.pdf,.png,.jpg,.zip,.gz"
              maxSize={100}
              onFile={handleUpload}
              progress={uploading ? uploadProgress : undefined}
            />
          </Card>
          <Card className="p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#243550]">
              <h2 className="font-semibold text-[#E8EEF7]">Evidence Files ({evidence.length})</h2>
            </div>
            {evidence.length === 0 ? (
              <EmptyState icon={FileText} title="No evidence uploaded" description="Upload evidence files to begin analysis." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#243550] text-[#8899AA]">
                    <th className="px-6 py-3 text-left font-medium">Filename</th>
                    <th className="px-6 py-3 text-left font-medium">Type</th>
                    <th className="px-6 py-3 text-left font-medium">Size</th>
                    <th className="px-6 py-3 text-left font-medium">SHA-256</th>
                    <th className="px-6 py-3 text-left font-medium">Status</th>
                    <th className="px-6 py-3 text-left font-medium">Uploaded</th>
                    <th className="px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2740]">
                  {evidence.map(ev => (
                    <tr key={ev.id} className="hover:bg-[#162235] transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-[#E8EEF7] truncate max-w-[180px]">{ev.filename}</td>
                      <td className="px-6 py-4">
                        <Badge variant="default" className="uppercase text-xs">{ev.file_type}</Badge>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[#8899AA]">
                        {ev.file_size ? `${(ev.file_size / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-[#4A5568] truncate max-w-[120px]">
                        {ev.sha256 ? ev.sha256.slice(0, 16) + '…' : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={ev.status === 'processed' ? 'success' : ev.status === 'failed' ? 'danger' : 'warning'}>
                          {ev.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#8899AA]">
                        {new Date(ev.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="p-1.5 rounded text-[#8899AA] hover:text-[#FF4757] hover:bg-[#FF475720] transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* Report Tab */}
      {tab === 'report' && (
        <div className="space-y-4">
          {!report ? (
            <EmptyState
              icon={BarChart3}
              title="No report generated"
              description="Generate a forensic report to see executive summary, findings, MITRE ATT&CK mapping and recommendations."
              action={
                <button
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {generating ? <LoadingSpinner size="sm" /> : <BarChart3 className="w-4 h-4" />}
                  Generate Report
                </button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#E8EEF7]">Forensic Report</h2>
                <button onClick={handleDownloadPdf} className="flex items-center gap-2 px-4 py-2 bg-[#162235] hover:bg-[#1E2F45] border border-[#243550] text-[#E8EEF7] rounded-lg text-sm transition-colors">
                  <Download className="w-4 h-4" /> Download PDF
                </button>
              </div>
              {report.report_data?.executive_summary && (
                <Card className="p-6">
                  <h3 className="font-semibold text-[#00D6C9] mb-2">Executive Summary</h3>
                  <p className="text-sm text-[#8899AA] leading-relaxed">{report.report_data.executive_summary}</p>
                </Card>
              )}
              {report.report_data?.findings && (
                <Card className="p-6">
                  <h3 className="font-semibold text-[#FF4757] mb-3">Threat Findings</h3>
                  <div className="space-y-2">
                    {report.report_data.findings.map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded bg-[#162235]">
                        <AlertTriangle className="w-4 h-4 text-[#F5B942] mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-[#E8EEF7]">{f.title || f.finding}</p>
                          {f.description && <p className="text-xs text-[#8899AA] mt-1">{f.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
              {report.report_data?.recommendations && (
                <Card className="p-6">
                  <h3 className="font-semibold text-[#35C98A] mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {report.report_data.recommendations.map((r: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#8899AA]">
                        <CheckCircle className="w-4 h-4 text-[#35C98A] mt-0.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Chat Tab */}
      {tab === 'chat' && (
        <Card className="flex flex-col h-[600px] overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-[#243550] flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-[#00D6C9]" />
            <h2 className="font-semibold text-[#E8EEF7]">AI Investigation Assistant</h2>
            <span className="text-xs text-[#4A5568]">— evidence-grounded responses</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Shield className="w-12 h-12 text-[#243550]" />
                <p className="text-[#8899AA] text-sm">Ask anything about this investigation</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Summarise threats found', 'What MITRE techniques apply?', 'List suspicious indicators', 'What are the recommendations?'].map(s => (
                    <button key={s} onClick={() => { setChatInput(s); }} className="px-3 py-1.5 rounded-full border border-[#243550] text-xs text-[#8899AA] hover:text-[#00D6C9] hover:border-[#00D6C9] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#00D6C920] border border-[#00D6C940] text-[#E8EEF7]'
                    : 'bg-[#162235] border border-[#243550] text-[#C8D6E8]'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-2 text-[#00D6C9] text-xs font-medium">
                      <Shield className="w-3 h-3" /> SHADOWTRACE AI
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {msg.sources.map((s, si) => (
                        <span key={si} className="px-2 py-0.5 rounded text-xs bg-[#243550] text-[#8899AA]">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-[#162235] border border-[#243550] rounded-xl px-4 py-3">
                  <LoadingSpinner size="sm" />
                </div>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-[#243550] flex gap-3">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
              placeholder="Ask about the investigation..."
              className="flex-1 bg-[#162235] border border-[#243550] rounded-lg px-4 py-2.5 text-sm text-[#E8EEF7] placeholder-[#4A5568] focus:outline-none focus:border-[#00D6C9] transition-colors"
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="px-4 py-2.5 bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
