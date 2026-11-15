import React, { useState, useEffect } from 'react'
import { Search, Plus, Folder, Clock, ChevronRight, Trash2, Edit3, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { investigationsApi } from '../../lib/api'
import { formatDate, getRiskColor } from '../../lib/utils'
import toast from 'react-hot-toast'
import type { Investigation } from '../../types'

const STATUS_OPTS = ['all', 'open', 'closed', 'archived']

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '' })

  const load = async () => {
    setLoading(true)
    try {
      const res = await investigationsApi.list({ search: search || undefined, status: status === 'all' ? undefined : status, size: 50 })
      setInvestigations(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch { toast.error('Failed to load investigations.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search, status])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setCreating(true)
    try {
      const inv = await investigationsApi.create({ title: form.title.trim(), description: form.description.trim() })
      toast.success('Investigation created.')
      setShowCreate(false)
      setForm({ title: '', description: '' })
      setInvestigations(prev => [inv, ...prev])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create investigation.')
    } finally { setCreating(false) }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await investigationsApi.delete(id)
      setInvestigations(prev => prev.filter(i => i.id !== id))
      toast.success('Investigation deleted.')
    } catch { toast.error('Failed to delete.') }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: '#E8EEF7' }}>Investigations</h1>
          <p className="text-[13px] mt-1" style={{ color: '#6B7F99' }}>{total} investigation{total !== 1 ? 's' : ''} in your workspace</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl px-4 h-9 text-[13px] font-medium shrink-0"
          style={{ background: '#00D6C9', color: '#04201f' }}>
          <Plus className="size-4" /> New Investigation
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4" style={{ color: '#3D5068' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search investigations…"
            className="w-full h-9 rounded-xl border pl-9 pr-4 text-[13px] outline-none"
            style={{ background: '#111B2B', borderColor: '#243550', color: '#E8EEF7' }} />
        </div>
        <div className="flex gap-2">
          {STATUS_OPTS.map(s => (
            <button key={s} onClick={() => setStatus(s)} className="h-9 px-3.5 rounded-xl text-[12px] font-medium capitalize transition-all"
              style={{ background: status === s ? 'rgba(0,214,201,0.15)' : '#111B2B', border: `1px solid ${status === s ? '#00D6C9' : '#243550'}`, color: status === s ? '#00D6C9' : '#6B7F99' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-[13px]" style={{ color: '#6B7F99' }}>Loading investigations…</div>
      ) : investigations.length === 0 ? (
        <div className="text-center py-20">
          <Folder className="size-16 mx-auto mb-4" style={{ color: '#1A2A3F' }} />
          <h3 className="text-[16px] font-semibold mb-2" style={{ color: '#E8EEF7' }}>No investigations found</h3>
          <p className="text-[13px] mb-6" style={{ color: '#6B7F99' }}>Create your first investigation to start analysing threats.</p>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl px-5 h-10 text-[13px] font-medium"
            style={{ background: '#00D6C9', color: '#04201f' }}><Plus className="size-4" />Create Investigation</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {investigations.map(inv => (
            <div key={inv.id} className="rounded-2xl p-5 transition-all hover:border-opacity-80 group relative"
              style={{ background: '#111B2B', border: '1px solid #1A2A3F' }}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] rounded-full px-2.5 py-1 font-medium capitalize"
                  style={{ background: inv.status === 'open' ? 'rgba(0,214,201,0.15)' : 'rgba(53,201,138,0.15)', color: inv.status === 'open' ? '#00D6C9' : '#35C98A' }}>
                  {inv.status}
                </span>
                <button onClick={() => handleDelete(inv.id, inv.title)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg" style={{ color: '#FF4757' }}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Link to={`/investigations/${inv.id}`}>
                <h3 className="text-[15px] font-semibold mb-2 hover:text-teal-400 transition-colors" style={{ color: '#E8EEF7' }}>{inv.title}</h3>
                {inv.description && <p className="text-[12px] leading-relaxed mb-4 line-clamp-2" style={{ color: '#6B7F99' }}>{inv.description}</p>}
              </Link>
              <div className="flex items-center justify-between text-[11px]" style={{ color: '#3D5068' }}>
                <div className="flex items-center gap-1.5"><Clock className="size-3.5" />{formatDate(inv.created_at)}</div>
                <Link to={`/investigations/${inv.id}`} className="flex items-center gap-1 hover:opacity-80" style={{ color: '#00D6C9' }}>
                  Open <ChevronRight className="size-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(8,13,22,0.8)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-[480px] rounded-2xl p-6" style={{ background: '#111B2B', border: '1px solid #243550' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-semibold" style={{ color: '#E8EEF7' }}>New Investigation</h2>
              <button onClick={() => setShowCreate(false)} style={{ color: '#6B7F99' }}><X className="size-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Phishing Campaign Analysis — Nov 2025"
                  required className="w-full h-10 rounded-xl border px-3.5 text-[13px] outline-none"
                  style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7' }}
                  onFocus={e => e.target.style.borderColor = '#00D6C9'}
                  onBlur={e => e.target.style.borderColor = '#243550'} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium" style={{ color: '#A0AEC0' }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of this investigation…"
                  rows={3} className="w-full rounded-xl border px-3.5 py-2.5 text-[13px] outline-none resize-none"
                  style={{ background: '#162235', borderColor: '#243550', color: '#E8EEF7' }}
                  onFocus={e => e.target.style.borderColor = '#00D6C9'}
                  onBlur={e => e.target.style.borderColor = '#243550'} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 h-10 rounded-xl text-[13px] font-medium"
                  style={{ background: '#162235', border: '1px solid #243550', color: '#A0AEC0' }}>Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 h-10 rounded-xl text-[13px] font-semibold disabled:opacity-70"
                  style={{ background: '#00D6C9', color: '#04201f' }}>
                  {creating ? 'Creating…' : 'Create Investigation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
