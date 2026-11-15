import React from 'react'
import { cn } from '../../lib/utils'

interface RiskMeterProps {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

function getRiskFromScore(score: number): { label: string; color: string; trackColor: string } {
  if (score >= 80) return { label: 'Critical', color: '#FF4757', trackColor: 'rgba(255,71,87,0.15)' }
  if (score >= 60) return { label: 'High', color: '#F5A623', trackColor: 'rgba(245,166,35,0.15)' }
  if (score >= 40) return { label: 'Medium', color: '#F5B942', trackColor: 'rgba(245,185,66,0.15)' }
  if (score >= 20) return { label: 'Low', color: '#35C98A', trackColor: 'rgba(53,201,138,0.15)' }
  return { label: 'Safe', color: '#35C98A', trackColor: 'rgba(53,201,138,0.15)' }
}

export function RiskMeter({ score, size = 'md', showLabel = true, className }: RiskMeterProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const { label, color } = getRiskFromScore(clamped)

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }
  const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className={cn('font-mono font-semibold', textSizes[size])} style={{ color }}>
            {label}
          </span>
          <span className={cn('font-mono text-muted', textSizes[size])}>
            {clamped}/100
          </span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-line overflow-hidden', heights[size])}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${clamped}%`,
            background: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
    </div>
  )
}

interface RiskScoreCircleProps {
  score: number
  size?: number
}

export function RiskScoreCircle({ score, size = 80 }: RiskScoreCircleProps) {
  const clamped = Math.max(0, Math.min(100, score))
  const { label, color } = getRiskFromScore(clamped)
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth="5"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s ease-out', filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-ink" style={{ fontSize: size * 0.22 }}>
            {clamped}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
