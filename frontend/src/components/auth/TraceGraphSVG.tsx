import React from 'react'

export function TraceGraphSVG({ className = '' }: { className?: string }) {
  const path = 'M70 70 L210 160 L370 236 L500 140'
  const NODES: [number, number][] = [
    [30, 150], [120, 30], [150, 250], [260, 50], [280, 290], [300, 140],
    [420, 60], [460, 280], [530, 230], [540, 50], [110, 130], [240, 220],
  ]
  const EDGES: [number, number][] = [
    [0, 10], [10, 1], [10, 2], [1, 3], [3, 5], [5, 11], [11, 2], [11, 4],
    [5, 6], [6, 9], [4, 7], [7, 8], [8, 9], [3, 6], [2, 4], [0, 2],
  ]
  const HOPS = [
    { x: 70, y: 70, label: 'payroll_notice.eml', note: 'Delivered 09:02', dx: 0, dy: -22, anchor: 'start' as const, c2: false },
    { x: 210, y: 160, label: 'ws-fin-07', note: 'upd_svc.exe executed', dx: -14, dy: 26, anchor: 'end' as const, c2: false },
    { x: 370, y: 236, label: 'fw-edge-01', note: '60s beacon interval', dx: 0, dy: 30, anchor: 'middle' as const, c2: false },
    { x: 500, y: 140, label: '91.203.5.146', note: 'Suspected C2', dx: 0, dy: -36, anchor: 'middle' as const, c2: true },
  ]

  return (
    <svg viewBox="0 0 560 320" fill="none" className={className} role="img" aria-label="Attack path graph">
      <defs>
        <filter id="st-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <g stroke="#1d2b40" strokeWidth="1">
        {EDGES.map(([a, b], i) => (
          <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
        ))}
      </g>
      <g fill="#2a3b55">
        {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} />)}
      </g>
      <path d={path} stroke="#00D6C9" strokeWidth="5" strokeOpacity="0.35" filter="url(#st-glow)" />
      <path d={path} stroke="#00A6C7" strokeWidth="1.4" strokeOpacity="0.9" />
      {HOPS.map((h) => (
        <g key={h.label}>
          <circle cx={h.x} cy={h.y} r="9" fill="#080d16" stroke={h.c2 ? '#FF4757' : '#00D6C9'} strokeWidth="1.4" />
          <circle cx={h.x} cy={h.y} r="3.2" fill={h.c2 ? '#FF4757' : '#19E6D2'} />
          <text x={h.x + h.dx} y={h.y + h.dy} fill={h.c2 ? '#ff8a94' : '#b4c0d0'} fontSize="11"
            fontFamily="JetBrains Mono, ui-monospace, monospace" textAnchor={h.anchor}>{h.label}</text>
          <text x={h.x + h.dx} y={h.y + h.dy + 14} fill="#5d6d84" fontSize="10"
            fontFamily="Inter, ui-sans-serif, sans-serif" textAnchor={h.anchor}>{h.note}</text>
        </g>
      ))}
    </svg>
  )
}
