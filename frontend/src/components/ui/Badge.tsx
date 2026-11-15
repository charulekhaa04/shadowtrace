import React from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant =
  | 'critical' | 'high' | 'medium' | 'low' | 'safe'
  | 'info' | 'open' | 'in_progress' | 'closed' | 'archived'
  | 'default'
  | 'danger' | 'success' | 'warning'   // aliases

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md'
  style?: React.CSSProperties
}

const variantClasses: Record<string, string> = {
  critical: 'bg-[#FF4757]/15 text-[#FF4757] border-[#FF4757]/30',
  danger:   'bg-[#FF4757]/15 text-[#FF4757] border-[#FF4757]/30',
  high:     'bg-orange-500/15 text-orange-400 border-orange-400/30',
  medium:   'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30',
  warning:  'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30',
  low:      'bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30',
  safe:     'bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30',
  success:  'bg-[#35C98A]/15 text-[#35C98A] border-[#35C98A]/30',
  info:     'bg-[#00A6C7]/15 text-[#00A6C7] border-[#00A6C7]/30',
  open:     'bg-[#00D6C9]/15 text-[#00D6C9] border-[#00D6C9]/30',
  in_progress: 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30',
  closed:   'bg-[#4A5568]/15 text-[#4A5568] border-[#4A5568]/30',
  archived: 'bg-[#243550]/20 text-[#4A5568] border-[#243550]/30',
  default:  'bg-[#243550] text-[#8899AA] border-[#243550]',
}

export function Badge({ variant = 'default', children, className, size = 'sm', style }: BadgeProps) {
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center font-mono font-medium border rounded-md uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        variantClasses[variant] || variantClasses.default,
        className
      )}
    >
      {children}
    </span>
  )
}

export default Badge
