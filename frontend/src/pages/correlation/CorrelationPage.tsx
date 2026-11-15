import React, { useState, useEffect, useCallback } from 'react'
import { GitBranch, Info, RefreshCw, Maximize2 } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { analysisApi, investigationsApi } from '../../lib/api'
import type { Investigation, CorrelationGraph } from '../../types'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'

const NODE_COLORS: Record<string, string> = {
  ip: '#FF4757',
  url: '#F5B942',
  email: '#00D6C9',
  domain: '#00A6C7',
  indicator: '#8899AA',
  investigation: '#00D6C9',
}

function buildReactFlowData(graph: CorrelationGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = (graph.nodes || []).map((n: any, i: number) => ({
    id: n.id,
    data: { label: n.label || n.id, type: n.type, risk: n.risk_level },
    position: {
      x: 300 * Math.cos((2 * Math.PI * i) / (graph.nodes?.length || 1)) + 500,
      y: 300 * Math.sin((2 * Math.PI * i) / (graph.nodes?.length || 1)) + 350,
    },
    style: {
      background: NODE_COLORS[n.type] || '#8899AA',
      color: '#080D16',
      border: n.risk_level === 'critical' ? '2px solid #FF4757' : '1px solid transparent',
      borderRadius: n.type === 'investigation' ? '50%' : 8,
      padding: '8px 12px',
      fontSize: 11,
      fontWeight: 600,
      fontFamily: 'JetBrains Mono, monospace',
      minWidth: 80,
      textAlign: 'center',
    },
  }))

  const edges: Edge[] = (graph.edges || []).map((e: any, i: number) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    label: e.relationship,
    style: { stroke: '#243550' },
    labelStyle: { fill: '#8899AA', fontSize: 10 },
    animated: e.relationship === 'connected_to',
  }))

  return { nodes, edges }
}

export default function CorrelationPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInv, setSelectedInv] = useState('')
  const [graph, setGraph] = useState<CorrelationGraph | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    investigationsApi.list({ size: 100 })
      .then(r => {
        setInvestigations(r.items)
        if (r.items.length > 0) setSelectedInv(r.items[0].id)
      })
      .catch(() => {})
  }, [])

  const loadGraph = useCallback(async () => {
    if (!selectedInv) return
    setLoading(true)
    setSelectedNode(null)
    try {
      const g = await analysisApi.getCorrelationGraph(selectedInv)
      setGraph(g)
      const { nodes: n, edges: e } = buildReactFlowData(g)
      setNodes(n)
      setEdges(e)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to load correlation graph')
    } finally {
      setLoading(false)
    }
  }, [selectedInv, setNodes, setEdges])

  useEffect(() => { loadGraph() }, [loadGraph])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7]">Evidence Correlation</h1>
          <p className="text-sm text-[#8899AA] mt-1">Interactive knowledge graph — relationships between indicators</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedInv}
            onChange={e => setSelectedInv(e.target.value)}
            className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">Select Investigation…</option>
            {investigations.map(inv => <option key={inv.id} value={inv.id}>{inv.title}</option>)}
          </select>
          <button onClick={loadGraph} disabled={loading || !selectedInv} className="p-2 rounded-lg border border-[#243550] text-[#8899AA] hover:text-[#E8EEF7] hover:bg-[#162235] transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ background: color }} />
            <span className="text-[#8899AA] capitalize">{type}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 h-[600px]">
        {/* Graph */}
        <div className="flex-1 rounded-xl overflow-hidden border border-[#243550] bg-[#080D16]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner size="lg" />
            </div>
          ) : !selectedInv ? (
            <EmptyState icon={GitBranch} title="Select an investigation" description="Choose an investigation to view its evidence correlation graph." />
          ) : nodes.length === 0 ? (
            <EmptyState icon={GitBranch} title="No correlation data" description="Run scans or upload evidence to this investigation to build the correlation graph." />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelectedNode(node)}
              fitView
              attributionPosition="bottom-right"
            >
              <Background color="#1A2740" variant={BackgroundVariant.Dots} />
              <Controls style={{ background: '#111B2B', border: '1px solid #243550' }} />
              <MiniMap style={{ background: '#0B1220', border: '1px solid #243550' }} nodeColor={n => NODE_COLORS[(n.data as any).type] || '#8899AA'} />
            </ReactFlow>
          )}
        </div>

        {/* Node detail sidebar */}
        {selectedNode && (
          <Card className="w-72 p-5 shrink-0 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#E8EEF7]">Node Details</h3>
              <button onClick={() => setSelectedNode(null)} className="text-[#4A5568] hover:text-[#E8EEF7]">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-[#8899AA] mb-1">Label</p>
                <p className="font-mono text-[#E8EEF7] break-all">{selectedNode.data.label}</p>
              </div>
              <div>
                <p className="text-xs text-[#8899AA] mb-1">Type</p>
                <Badge variant="info" className="capitalize">{selectedNode.data.type}</Badge>
              </div>
              {selectedNode.data.risk && (
                <div>
                  <p className="text-xs text-[#8899AA] mb-1">Risk Level</p>
                  <Badge variant={selectedNode.data.risk === 'critical' ? 'danger' : selectedNode.data.risk === 'high' ? 'warning' : 'default'} className="capitalize">
                    {selectedNode.data.risk}
                  </Badge>
                </div>
              )}
              <div>
                <p className="text-xs text-[#8899AA] mb-1">Node ID</p>
                <p className="font-mono text-xs text-[#4A5568] break-all">{selectedNode.id}</p>
              </div>
            </div>
            <div className="pt-2 border-t border-[#243550] text-xs text-[#4A5568] flex items-start gap-2">
              <Info className="w-3 h-3 mt-0.5 shrink-0" />
              Edge labels show the relationship type between connected indicators.
            </div>
          </Card>
        )}
      </div>

      {graph && (
        <p className="text-xs text-[#4A5568]">
          {graph.nodes?.length || 0} nodes · {graph.edges?.length || 0} edges
        </p>
      )}
    </div>
  )
}
