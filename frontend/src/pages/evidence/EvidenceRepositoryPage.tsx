import React, { useState, useEffect, useCallback } from 'react'
import { FileText, Upload, Trash2, Filter, Search, Database } from 'lucide-react'
import toast from 'react-hot-toast'
import { evidenceApi, investigationsApi } from '../../lib/api'
import type { Evidence, Investigation } from '../../types'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import FileUpload from '../../components/ui/FileUpload'

const FILE_TYPE_COLORS: Record<string, string> = {
  csv: 'info', json: 'warning', log: 'default',
  txt: 'default', pcap: 'danger', pdf: 'success',
}

export default function EvidenceRepositoryPage() {
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterInv, setFilterInv] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [evResp, invResp] = await Promise.all([
        evidenceApi.list({ investigation_id: filterInv || undefined, file_type: filterType || undefined, page, size: 25 }),
        investigationsApi.list({ size: 100 }),
      ])
      setEvidence(evResp.items)
      setTotal(evResp.total)
      setInvestigations(invResp.items)
    } catch {
      toast.error('Failed to load evidence')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterInv, page])

  useEffect(() => { load() }, [load])

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    try {
      const ev = await evidenceApi.upload(file, filterInv || undefined, setUploadProgress)
      setEvidence(prev => [ev, ...prev])
      setTotal(t => t + 1)
      toast.success('Evidence uploaded successfully')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await evidenceApi.delete(id)
      setEvidence(prev => prev.filter(e => e.id !== id))
      setTotal(t => t - 1)
      toast.success('Evidence deleted')
    } catch {
      toast.error('Delete failed')
    }
  }

  const filtered = evidence.filter(ev =>
    !search || ev.filename.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7]">Evidence Repository</h1>
          <p className="text-sm text-[#8899AA] mt-1">Upload and manage evidence files across all investigations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111B2B] border border-[#243550] rounded-lg">
          <Database className="w-4 h-4 text-[#00D6C9]" />
          <span className="text-sm font-mono text-[#E8EEF7]">{total}</span>
          <span className="text-xs text-[#8899AA]">files</span>
        </div>
      </div>

      {/* Upload */}
      <Card className="p-6">
        <h2 className="font-semibold text-[#E8EEF7] mb-1">Upload New Evidence</h2>
        <p className="text-xs text-[#8899AA] mb-4">Supported: TXT, LOG, CSV, JSON, PCAP, PDF, PNG, ZIP (max 100 MB)</p>
        <div className="mb-4">
          <label className="block text-xs text-[#8899AA] mb-1">Link to Investigation (optional)</label>
          <select
            value={filterInv}
            onChange={e => setFilterInv(e.target.value)}
            className="bg-[#162235] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">— Unlinked —</option>
            {investigations.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.title}</option>
            ))}
          </select>
        </div>
        <FileUpload
          accept=".txt,.log,.csv,.json,.pcap,.pcapng,.pdf,.png,.jpg,.zip,.gz"
          maxSize={100}
          onFile={handleUpload}
          progress={uploading ? uploadProgress : undefined}
        />
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search filenames..."
            className="w-full pl-9 pr-4 py-2 bg-[#111B2B] border border-[#243550] rounded-lg text-sm text-[#E8EEF7] placeholder-[#4A5568] focus:outline-none focus:border-[#00D6C9]"
          />
        </div>
        <select
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
        >
          <option value="">All Types</option>
          {['csv', 'json', 'log', 'txt', 'pcap', 'pdf', 'png'].map(t => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={filterInv}
          onChange={e => { setFilterInv(e.target.value); setPage(1) }}
          className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
        >
          <option value="">All Investigations</option>
          {investigations.map(inv => (
            <option key={inv.id} value={inv.id}>{inv.title}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><LoadingSpinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No evidence files" description="Upload your first evidence file to get started." />
        ) : (
          <>
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
                {filtered.map(ev => (
                  <tr key={ev.id} className="hover:bg-[#162235] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#4A5568] shrink-0" />
                        <span className="font-mono text-xs text-[#E8EEF7] truncate max-w-[200px]">{ev.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={(FILE_TYPE_COLORS[ev.file_type] || 'default') as any} className="uppercase text-xs">
                        {ev.file_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#8899AA]">
                      {ev.file_size ? `${(ev.file_size / 1024).toFixed(1)} KB` : '—'}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[#4A5568] max-w-[120px] truncate">
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
                        onClick={() => handleDelete(ev.id)}
                        className="p-1.5 rounded text-[#8899AA] hover:text-[#FF4757] hover:bg-[#FF475720] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 25 && (
              <div className="px-6 py-3 border-t border-[#243550] flex justify-between items-center text-sm text-[#8899AA]">
                <span>Showing {filtered.length} of {total}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border border-[#243550] hover:border-[#00D6C9] disabled:opacity-40 transition-colors">Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={evidence.length < 25} className="px-3 py-1 rounded border border-[#243550] hover:border-[#00D6C9] disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
