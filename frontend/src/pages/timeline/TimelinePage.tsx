import React, { useState, useEffect, useCallback } from 'react'
import { Clock, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { investigationsApi } from '../../lib/api'
import type { Investigation, TimelineEvent } from '../../types'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#FF4757',
  high: '#FF6B81',
  medium: '#F5B942',
  low: '#00D6C9',
  info: '#8899AA',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

export default function TimelinePage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInv, setSelectedInv] = useState('')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    investigationsApi.list({ size: 100 })
      .then(r => {
        setInvestigations(r.items)
        if (r.items.length > 0) setSelectedInv(r.items[0].id)
      })
      .catch(() => {})
  }, [])

  const loadTimeline = useCallback(async () => {
    if (!selectedInv) return
    setLoading(true)
    try {
      const data = await investigationsApi.getTimeline(selectedInv)
      setEvents(data)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }, [selectedInv])

  useEffect(() => { loadTimeline() }, [loadTimeline])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const filtered = events.filter(e => !filterSeverity || e.severity === filterSeverity)
  const sorted = [...filtered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7]">Incident Timeline</h1>
          <p className="text-sm text-[#8899AA] mt-1">Chronological security events — observed and inferred</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">All Severities</option>
            {SEVERITY_ORDER.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select
            value={selectedInv}
            onChange={e => setSelectedInv(e.target.value)}
            className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">Select Investigation…</option>
            {investigations.map(inv => <option key={inv.id} value={inv.id}>{inv.title}</option>)}
          </select>
          <button onClick={loadTimeline} disabled={loading || !selectedInv} className="p-2 rounded-lg border border-[#243550] text-[#8899AA] hover:text-[#E8EEF7] hover:bg-[#162235] disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {events.length > 0 && (
        <div className="flex gap-4">
          {SEVERITY_ORDER.map(sev => {
            const count = events.filter(e => e.severity === sev).length
            if (count === 0) return null
            return (
              <button
                key={sev}
                onClick={() => setFilterSeverity(filterSeverity === sev ? '' : sev)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                  filterSeverity === sev ? 'border-current' : 'border-[#243550] text-[#8899AA]'
                }`}
                style={filterSeverity === sev ? { color: SEVERITY_COLORS[sev], borderColor: SEVERITY_COLORS[sev] } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
                {sev}: {count}
              </button>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><LoadingSpinner size="lg" /></div>
      ) : !selectedInv ? (
        <EmptyState icon={Clock} title="Select an investigation" description="Choose an investigation to view its incident timeline." />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No timeline events"
          description="Run analysis or generate a report on this investigation to build the incident timeline."
        />
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-[#243550]" />

          <div className="space-y-0">
            {sorted.map((event, i) => {
              const color = SEVERITY_COLORS[event.severity] || '#8899AA'
              const isExpanded = expanded.has(event.id)
              const isInferred = event.is_inferred

              return (
                <div key={event.id} className="relative flex gap-6 pb-6 pl-14">
                  {/* Dot */}
                  <div
                    className="absolute left-4 top-1 w-4 h-4 rounded-full border-2 border-[#080D16] flex items-center justify-center shrink-0"
                    style={{ background: color }}
                  >
                    {event.severity === 'critical' && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </div>

                  {/* Card */}
                  <div
                    className={`flex-1 rounded-xl border p-4 cursor-pointer transition-colors ${
                      isInferred
                        ? 'border-dashed border-[#243550] bg-[#0B1220]'
                        : 'border-[#243550] bg-[#111B2B] hover:bg-[#162235]'
                    }`}
                    onClick={() => toggleExpand(event.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-[#E8EEF7]">{event.title}</span>
                            {isInferred && (
                              <Badge variant="default" className="text-xs font-mono border border-dashed border-[#243550]">
                                INFERRED
                              </Badge>
                            )}
                            <Badge variant={event.severity === 'critical' ? 'danger' : event.severity === 'high' ? 'danger' : event.severity === 'medium' ? 'warning' : 'default'}>
                              {event.severity}
                            </Badge>
                          </div>
                          <p className="text-xs font-mono text-[#4A5568] mt-1">{new Date(event.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#4A5568] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#4A5568] shrink-0" />}
                    </div>

                    {!isExpanded && event.description && (
                      <p className="text-xs text-[#8899AA] mt-2 line-clamp-2">{event.description}</p>
                    )}

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#243550] space-y-2">
                        {event.description && <p className="text-sm text-[#8899AA] leading-relaxed">{event.description}</p>}
                        {event.source && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#4A5568]">Source:</span>
                            <span className="font-mono text-[#00D6C9]">{event.source}</span>
                          </div>
                        )}
                        {event.mitre_technique && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#4A5568]">MITRE:</span>
                            <Badge variant="info" className="text-xs font-mono">{event.mitre_technique}</Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
