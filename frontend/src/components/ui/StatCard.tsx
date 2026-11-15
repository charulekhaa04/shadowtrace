import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend?: {
    value: number
    label?: string
    direction: 'up' | 'down' | 'neutral'
  }
  iconColor?: string
  iconBg?: string
  className?: string
  loading?: boolean
}

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  iconColor = 'text-teal',
  iconBg = 'bg-teal/10',
  className,
  loading,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-card p-5 flex items-start gap-4',
        className
      )}
    >
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>

      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="space-y-2">
            <div className="h-7 w-16 bg-surface rounded animate-pulse" />
            <div className="h-3 w-24 bg-surface rounded animate-pulse" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold font-mono text-ink leading-none mb-1">{value}</div>
            <div className="text-xs text-muted">{label}</div>
            {trend && (
              <div
                className={cn(
                  'flex items-center gap-1 mt-2 text-xs font-medium',
                  trend.direction === 'up' && trend.value > 0 ? 'text-critical' : '',
                  trend.direction === 'down' && trend.value > 0 ? 'text-success' : '',
                  trend.direction === 'neutral' ? 'text-muted' : ''
                )}
              >
                {trend.direction === 'up' && <TrendingUp size={12} />}
                {trend.direction === 'down' && <TrendingDown size={12} />}
                {trend.direction === 'neutral' && <Minus size={12} />}
                <span>
                  {trend.value > 0 ? '+' : ''}{trend.value}
                  {trend.label ? ` ${trend.label}` : '%'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
