import React from 'react'
import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  action?: React.ReactNode
  noPadding?: boolean
}

export function Card({ children, className, title, subtitle, action, noPadding }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-card',
        !noPadding && 'p-5',
        className
      )}
    >
      {(title || action) && (
        <div className={cn('flex items-start justify-between', !noPadding ? 'mb-4' : 'px-5 pt-5 mb-4')}>
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-ink tracking-wide">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-4">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

export default Card
