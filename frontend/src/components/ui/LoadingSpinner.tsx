import React from 'react'
import { cn } from '../../lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  fullPage?: boolean
}

const sizes = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
  xl: 'w-16 h-16 border-4',
}

export function LoadingSpinner({ size = 'md', className, fullPage }: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={cn(
        'rounded-full border-teal/20 border-t-teal animate-spin',
        sizes[size],
        className
      )}
    />
  )

  if (fullPage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm z-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-teal/20 border-t-teal animate-spin" />
          <span className="text-sm text-muted font-mono">Processing...</span>
        </div>
      </div>
    )
  }

  return spinner
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-[3px] border-teal/20 border-t-teal animate-spin" />
        <p className="text-sm text-muted font-mono">Loading...</p>
      </div>
    </div>
  )
}

export default LoadingSpinner
