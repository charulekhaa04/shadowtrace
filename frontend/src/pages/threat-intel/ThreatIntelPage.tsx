import React, { useState, useEffect } from 'react'
import { Search, Shield, Target, Database, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { threatIntelApi } from '../../lib/api'
import type { MitreTechnique, ThreatIndicator } from '../../types'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'

const TACTIC_COLORS: Record<string, string> = {
  'initial-access': '#FF4757',
  'execution': '#FF6B81',
  'persistence': '#F5B942',
  'privilege-escalation': '#F5B942',
  'defense-evasion': '#00A6C7',
  'credential-access': '#FF4757',
  'discovery': '#8899AA',
  'lateral-movement': '#F5B942',
  'collection': '#00D6C9',
  'command-and-control': '#FF4757',
  'exfiltration': '#FF4757',
  'impact': '#FF4757',
}

const TABS = ['MITRE ATT&CK', 'Indicators', 'Search'] as const
type Tab = typeof TABS[number]

function MitreCard({ technique }: { technique: MitreTechnique }) {
  const [expanded, setExpanded] = useState(false)
  const color = TACTIC_COLORS[technique.tactic?.toLowerCase().replace(/\s/g, '-') || ''] || '#8899AA'
  return (
    <Card className="p-5 cursor-pointer hover:border-[#00D6C940] transition-colors" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="font-mono text-xs font-bold text-[#00A6C7]">{technique.technique_id}</span>
        <Badge variant="default" className="text-xs shrink-0 capitalize" style={{ color, borderColor: color + '44', background: color + '11' }}>
          {technique.tactic}
        </Badge>
      </div>
      <h3 className="text-sm font-semibold text-[#E8EEF7] mb-2">{technique.name}</h3>
      <p className={`text-xs text-[#8899AA] leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
        {technique.description}
      </p>
      {technique.description && technique.description.length > 150 && (
        <button className="text-xs text-[#00D6C9] mt-1 hover:underline">{expanded ? 'Show less' : 'Show more'}</button>
      )}
    </Card>
  )
}

export default function ThreatIntelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('MITRE ATT&CK')
  const [techniques, setTechniques] = useState<MitreTechnique[]>([])
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ThreatIndicator[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [tacticFilter, setTacticFilter] = useState('')
  const [indicatorType, setIndicatorType] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (activeTab === 'MITRE ATT&CK') {
      setLoading(true)
      threatIntelApi.getMitreTechniques(tacticFilter || undefined)
        .then(setTechniques)
        .catch(() => toast.error('Failed to load MITRE data'))
        .finally(() => setLoading(false))
    } else if (activeTab === 'Indicators') {
      setLoading(true)
      threatIntelApi.getIndicators({ type: indicatorType || undefined, page, size: 25 })
        .then(r => { setIndicators(r.items); setTotal(r.total) })
        .catch(() => toast.error('Failed to load indicators'))
        .finally(() => setLoading(false))
    }
  }, [activeTab, tacticFilter, indicatorType, page])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const r = await threatIntelApi.search(searchQuery)
      setSearchResults(r.results)
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const tactics = [...new Set(techniques.map(t => t.tactic).filter(Boolean))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8EEF7]">Threat Intelligence Library</h1>
        <p className="text-sm text-[#8899AA] mt-1">
          MITRE ATT&CK techniques, threat indicators and CTI from SMAH-CTI dataset
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#243550]">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => { setActiveTab(t); setPage(1) }}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t
                ? 'border-[#00D6C9] text-[#00D6C9]'
                : 'border-transparent text-[#8899AA] hover:text-[#E8EEF7]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* MITRE ATT&CK Tab */}
      {activeTab === 'MITRE ATT&CK' && (
        <>
          <div className="flex flex-wrap gap-3">
            <select
              value={tacticFilter}
              onChange={e => setTacticFilter(e.target.value)}
              className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
            >
              <option value="">All Tactics</option>
              {tactics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-sm text-[#4A5568] flex items-center">{techniques.length} techniques</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40"><LoadingSpinner size="lg" /></div>
          ) : techniques.length === 0 ? (
            <EmptyState icon={Target} title="No MITRE techniques" description="MITRE ATT&CK data will be populated from the threat intelligence database." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {techniques.map(t => <MitreCard key={t.technique_id} technique={t} />)}
            </div>
          )}
        </>
      )}

      {/* Indicators Tab */}
      {activeTab === 'Indicators' && (
        <>
          <div className="flex gap-3">
            <select
              value={indicatorType}
              onChange={e => { setIndicatorType(e.target.value); setPage(1) }}
              className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
            >
              <option value="">All Types</option>
              {['ip', 'domain', 'url', 'hash', 'email', 'malware'].map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
            <span className="text-sm text-[#4A5568] flex items-center">{total} indicators</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40"><LoadingSpinner size="lg" /></div>
          ) : indicators.length === 0 ? (
            <EmptyState icon={Database} title="No indicators" description="Threat indicators are populated as you scan URLs, IPs and emails." />
          ) : (
            <Card className="p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#243550] text-[#8899AA]">
                    <th className="px-6 py-3 text-left font-medium">Type</th>
                    <th className="px-6 py-3 text-left font-medium">Value</th>
                    <th className="px-6 py-3 text-left font-medium">Threat Type</th>
                    <th className="px-6 py-3 text-left font-medium">Confidence</th>
                    <th className="px-6 py-3 text-left font-medium">Source</th>
                    <th className="px-6 py-3 text-left font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2740]">
                  {indicators.map(ind => (
                    <tr key={ind.id} className="hover:bg-[#162235] transition-colors">
                      <td className="px-6 py-3">
                        <Badge variant="info" className="text-xs uppercase">{ind.indicator_type}</Badge>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[#00D6C9] max-w-[200px] truncate">{ind.value}</td>
                      <td className="px-6 py-3 text-xs text-[#E8EEF7]">{ind.threat_type || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#243550] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{
                              width: `${(ind.confidence || 0) * 100}%`,
                              background: (ind.confidence || 0) >= 0.8 ? '#35C98A' : (ind.confidence || 0) >= 0.5 ? '#F5B942' : '#FF4757'
                            }} />
                          </div>
                          <span className="font-mono text-xs text-[#4A5568]">{Math.round((ind.confidence || 0) * 100)}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-xs text-[#8899AA]">{ind.source || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(ind.tags || []).slice(0, 3).map((tag, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-[#243550] text-xs text-[#8899AA]">{tag}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > 25 && (
                <div className="px-6 py-3 border-t border-[#243550] flex justify-between items-center text-sm text-[#8899AA]">
                  <span>Page {page} · {total} total</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded border border-[#243550] hover:border-[#00D6C9] disabled:opacity-40 transition-colors">Prev</button>
                    <button onClick={() => setPage(p => p + 1)} disabled={indicators.length < 25} className="px-3 py-1 rounded border border-[#243550] hover:border-[#00D6C9] disabled:opacity-40 transition-colors">Next</button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Search Tab */}
      {activeTab === 'Search' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5568]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Search threat intelligence (IP, domain, technique, malware…)"
                className="w-full pl-9 pr-4 py-3 bg-[#111B2B] border border-[#243550] rounded-lg text-sm text-[#E8EEF7] placeholder-[#4A5568] focus:outline-none focus:border-[#00D6C9]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-5 py-3 bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {searching ? <LoadingSpinner size="sm" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#243550]">
                <h3 className="font-semibold text-[#E8EEF7]">{searchResults.length} results for "{searchQuery}"</h3>
              </div>
              <div className="divide-y divide-[#1A2740]">
                {searchResults.map(r => (
                  <div key={r.id} className="px-6 py-4 hover:bg-[#162235] transition-colors">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge variant="info" className="text-xs uppercase">{r.indicator_type}</Badge>
                      <span className="font-mono text-sm text-[#00D6C9]">{r.value}</span>
                    </div>
                    {r.threat_type && <p className="text-xs text-[#8899AA]">{r.threat_type}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
          {searching && (
            <div className="flex items-center justify-center h-20"><LoadingSpinner size="lg" /></div>
          )}
        </div>
      )}
    </div>
  )
}
