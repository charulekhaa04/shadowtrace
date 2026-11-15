import React, { useState } from 'react'
import {
  Upload, Network, AlertTriangle, CheckCircle, Activity,
  BarChart2, Cpu, Shield, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { analysisApi, investigationsApi } from '../../lib/api'
import type { NetworkAnalysisResult, Investigation } from '../../types'
import Card from '../../components/ui/Card'
import FileUpload from '../../components/ui/FileUpload'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Badge from '../../components/ui/Badge'

const ATTACK_COLORS: Record<string, string> = {
  BENIGN: '#35C98A',
  'DoS': '#FF4757',
  'DDoS': '#FF4757',
  'PortScan': '#F5B942',
  'Brute Force': '#F5B942',
  'Web Attack': '#FF4757',
  'Infiltration': '#FF4757',
  'Bot': '#FF6B81',
  'Heartbleed': '#FF4757',
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl`} style={{ background: color + '22' }}>
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-[#8899AA]">{label}</p>
        <p className="text-xl font-bold font-mono text-[#E8EEF7]">{value}</p>
      </div>
    </Card>
  )
}

export default function NetworkAnalysisPage() {
  const [result, setResult] = useState<NetworkAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInv, setSelectedInv] = useState('')

  React.useEffect(() => {
    investigationsApi.list({ size: 100 }).then(r => setInvestigations(r.items)).catch(() => {})
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast.error('Only CSV files are supported for network traffic analysis')
      return
    }
    setLoading(true)
    setProgress(0)
    setResult(null)
    try {
      const res = await analysisApi.analyzeNetwork(file, selectedInv || undefined, setProgress)
      setResult(res)
      toast.success('Network traffic analysis complete')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const attackChartData = result
    ? Object.entries(result.attack_distribution || {}).map(([name, count]) => ({ name, count }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E8EEF7]">Network Traffic Analysis</h1>
        <p className="text-sm text-[#8899AA] mt-1">
          Upload CIC-IDS2017 format CSV — ML models detect anomalies and classify attack patterns
        </p>
      </div>

      {/* Upload section */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Network className="w-5 h-5 text-[#00D6C9]" />
          <h2 className="font-semibold text-[#E8EEF7]">Upload Network Traffic CSV</h2>
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
          accept=".csv"
          maxSize={200}
          onFile={handleFile}
          progress={loading ? progress : undefined}
          label="Drop CSV file here or click to upload"
          sublabel="Network traffic export (CIC-IDS2017 format), max 200 MB"
        />
        {loading && (
          <div className="flex items-center gap-3 text-sm text-[#8899AA]">
            <LoadingSpinner size="sm" />
            <span>Running ML classifiers… {progress}%</span>
          </div>
        )}
      </Card>

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Activity} label="Total Flows" value={result.total_flows.toLocaleString()} color="#00D6C9" />
            <StatCard icon={CheckCircle} label="Benign" value={result.benign_count.toLocaleString()} color="#35C98A" />
            <StatCard icon={AlertTriangle} label="Attacks Detected" value={result.attack_count.toLocaleString()} color="#FF4757" />
            <StatCard icon={Cpu} label="Anomaly Score" value={`${(result.anomaly_score * 100).toFixed(1)}%`} color="#F5B942" />
          </div>

          {/* Attack distribution chart */}
          {attackChartData.length > 0 && (
            <Card className="p-6">
              <h2 className="font-semibold text-[#E8EEF7] mb-4">Attack Distribution</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attackChartData} margin={{ top: 0, right: 0, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1A2740" />
                  <XAxis dataKey="name" tick={{ fill: '#8899AA', fontSize: 11 }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fill: '#8899AA', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#111B2B', border: '1px solid #243550', borderRadius: 8 }}
                    labelStyle={{ color: '#E8EEF7' }}
                    itemStyle={{ color: '#00D6C9' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {attackChartData.map((entry, i) => (
                      <Cell key={i} fill={ATTACK_COLORS[entry.name] || '#00D6C9'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Suspicious IPs */}
          {result.suspicious_ips && result.suspicious_ips.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#243550]">
                <h2 className="font-semibold text-[#E8EEF7]">Top Suspicious IPs</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#243550] text-[#8899AA]">
                    <th className="px-6 py-3 text-left font-medium">IP Address</th>
                    <th className="px-6 py-3 text-left font-medium">Attack Type</th>
                    <th className="px-6 py-3 text-left font-medium">Flow Count</th>
                    <th className="px-6 py-3 text-left font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A2740]">
                  {result.suspicious_ips.slice(0, 20).map((ip: any, i: number) => (
                    <tr key={i} className="hover:bg-[#162235] transition-colors">
                      <td className="px-6 py-3 font-mono text-xs text-[#00D6C9]">{ip.ip}</td>
                      <td className="px-6 py-3">
                        <Badge variant="danger" className="text-xs">{ip.attack_type}</Badge>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-[#E8EEF7]">{ip.count}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-[#243550] rounded-full overflow-hidden">
                            <div className="h-full bg-[#FF4757] rounded-full" style={{ width: `${Math.min(100, (ip.count / (result.suspicious_ips[0]?.count || 1)) * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {/* Feature importance */}
          {result.feature_importance && result.feature_importance.length > 0 && (
            <Card className="p-6">
              <h2 className="font-semibold text-[#E8EEF7] mb-4">Top Feature Importances</h2>
              <div className="space-y-2">
                {result.feature_importance.slice(0, 10).map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#8899AA] w-48 truncate">{f.feature}</span>
                    <div className="flex-1 h-2 bg-[#1A2740] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00D6C9] rounded-full transition-all"
                        style={{ width: `${(f.importance / (result.feature_importance[0]?.importance || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-[#4A5568] w-16 text-right">{(f.importance * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Model info */}
          <div className="text-xs text-[#4A5568] flex items-center gap-2 px-1">
            <Shield className="w-3 h-3" />
            Analysis performed using Random Forest + XGBoost trained on CIC-IDS2017.
            Results represent ML predictions — always verify with domain expertise.
          </div>
        </>
      )}
    </div>
  )
}
