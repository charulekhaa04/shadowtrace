import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export function getRiskColor(level: string): string {
  const map: Record<string, string> = {
    critical: '#FF4757', high: '#FF8C00', medium: '#F5B942', low: '#00A6C7', safe: '#35C98A', info: '#6B7F99'
  }
  return map[level?.toLowerCase()] ?? '#6B7F99'
}

export function truncate(str: string, n: number): string {
  return str && str.length > n ? str.slice(0, n) + '…' : str
}

export function getRiskBadgeStyle(level: string): React.CSSProperties {
  const color = getRiskColor(level)
  return { background: `${color}20`, color, border: `1px solid ${color}40` }
}
