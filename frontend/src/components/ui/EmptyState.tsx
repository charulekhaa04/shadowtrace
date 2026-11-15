import React from 'react'
import { cn } from '../../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode | { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-[#111B2B] border border-[#243550] flex items-center justify-center mb-4">
          <Icon size={24} className="text-[#4A5568]" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#8899AA] mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-[#4A5568] max-w-xs leading-relaxed mb-5">{description}</p>
      )}
      {action && (
        React.isValidElement(action)
          ? <div className="mt-2">{action}</div>
          : (
            <button
              onClick={(action as { label: string; onClick: () => void }).onClick}
              className="px-4 py-2 rounded-lg bg-[#00D6C9]/10 border border-[#00D6C9]/30 text-[#00D6C9] text-sm font-medium hover:bg-[#00D6C9]/20 transition-colors"
            >
              {(action as { label: string; onClick: () => void }).label}
            </button>
          )
      )}
    </div>
  )
}

export default EmptyState
