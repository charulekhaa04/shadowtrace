import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Shield, Send, RefreshCw, Sparkles, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { aiApi, investigationsApi } from '../../lib/api'
import type { Investigation, ChatMessage } from '../../types'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const SUGGESTED_PROMPTS = [
  'Summarise threats found in this investigation',
  'What MITRE ATT&CK techniques apply?',
  'List all suspicious indicators found',
  'What are the top defensive recommendations?',
  'Describe the attack chain reconstructed',
  'Are there any indicators of lateral movement?',
]

function ConfidenceBar({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? '#35C98A' : pct >= 50 ? '#F5B942' : '#FF4757'
  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-[#4A5568]">Confidence</span>
      <div className="flex-1 h-1 bg-[#243550] rounded-full max-w-[80px] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  )
}

export default function AIAssistantPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [selectedInv, setSelectedInv] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    investigationsApi.list({ size: 100 })
      .then(r => {
        setInvestigations(r.items)
        if (r.items.length > 0) setSelectedInv(r.items[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (text?: string) => {
    const q = (text || input).trim()
    if (!q) return
    if (!selectedInv) { toast.error('Please select an investigation first'); return }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const resp = await aiApi.chat(q, selectedInv)
      setMessages(prev => [...prev, resp])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'AI request failed')
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => { setMessages([]) }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EEF7]">AI Investigation Assistant</h1>
          <p className="text-sm text-[#8899AA] mt-1">RAG-powered — responses grounded in your evidence and threat intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedInv}
            onChange={e => { setSelectedInv(e.target.value); setMessages([]) }}
            className="bg-[#111B2B] border border-[#243550] rounded-lg px-3 py-2 text-sm text-[#E8EEF7] focus:outline-none focus:border-[#00D6C9]"
          >
            <option value="">Select Investigation…</option>
            {investigations.map(inv => <option key={inv.id} value={inv.id}>{inv.title}</option>)}
          </select>
          {messages.length > 0 && (
            <button onClick={handleClear} className="text-xs text-[#8899AA] hover:text-[#E8EEF7] px-3 py-2 rounded-lg border border-[#243550] hover:bg-[#162235] transition-colors">
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col overflow-hidden p-0 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
          {!selectedInv ? (
            <EmptyState icon={MessageSquare} title="Select an investigation" description="Choose an investigation context so the AI can reference your evidence and findings." />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="p-4 rounded-2xl bg-[#162235] border border-[#243550]">
                <Shield className="w-10 h-10 text-[#00D6C9]" />
              </div>
              <div>
                <p className="text-[#E8EEF7] font-semibold">SHADOWTRACE AI is ready</p>
                <p className="text-sm text-[#8899AA] mt-1">Ask anything about the selected investigation</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SUGGESTED_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-3 py-2 rounded-full border border-[#243550] text-xs text-[#8899AA] hover:text-[#00D6C9] hover:border-[#00D6C9] transition-colors text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-4 ${
                  msg.role === 'user'
                    ? 'bg-[#00D6C920] border border-[#00D6C940]'
                    : 'bg-[#111B2B] border border-[#243550]'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-4 h-4 text-[#00D6C9]" />
                      <span className="text-xs font-semibold text-[#00D6C9] tracking-wide">SHADOWTRACE AI</span>
                      <Sparkles className="w-3 h-3 text-[#00D6C9] opacity-60" />
                    </div>
                  )}
                  <p className="text-sm text-[#E8EEF7] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#243550]">
                          <p className="text-xs text-[#4A5568] mb-1.5">Sources</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((s, si) => (
                              <span key={si} className="px-2 py-0.5 rounded bg-[#243550] text-xs font-mono text-[#8899AA]">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <ConfidenceBar confidence={msg.confidence} />
                      <p className="text-xs text-[#4A5568] mt-2 italic">
                        AI-generated analysis — verify with authoritative sources before treating as confirmed forensic evidence.
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#111B2B] border border-[#243550] rounded-2xl px-5 py-4 flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#00D6C9]" />
                <LoadingSpinner size="sm" />
                <span className="text-xs text-[#8899AA]">Analysing evidence…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[#243550] px-6 py-4 flex gap-3 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={selectedInv ? 'Ask about the investigation…' : 'Select an investigation first'}
            disabled={!selectedInv}
            rows={2}
            className="flex-1 resize-none bg-[#162235] border border-[#243550] rounded-xl px-4 py-3 text-sm text-[#E8EEF7] placeholder-[#4A5568] focus:outline-none focus:border-[#00D6C9] transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading || !selectedInv}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#00D6C9] hover:bg-[#00B8B2] text-[#080D16] transition-colors disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </div>
  )
}
