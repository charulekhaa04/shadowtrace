import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderSearch,
  Scan,
  Database,
  BarChart3,
  Network,
  Clock,
  Bot,
  FileText,
  Shield,
  Settings,
  ChevronRight,
  Activity,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  group?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'Investigations', path: '/investigations', icon: FolderSearch, group: 'main' },
  { label: 'Threat Scanner', path: '/scanner', icon: Scan, group: 'main' },
  { label: 'Evidence Repository', path: '/evidence', icon: Database, group: 'analysis' },
  { label: 'Network Analysis', path: '/analysis/network', icon: BarChart3, group: 'analysis' },
  { label: 'Log Analysis', path: '/analysis/logs', icon: Activity, group: 'analysis' },
  { label: 'Evidence Correlation', path: '/correlation', icon: Network, group: 'analysis' },
  { label: 'Incident Timeline', path: '/timeline', icon: Clock, group: 'analysis' },
  { label: 'AI Assistant', path: '/ai', icon: Bot, group: 'intel' },
  { label: 'Reports', path: '/reports', icon: FileText, group: 'intel' },
  { label: 'Threat Intel', path: '/threat-intel', icon: Shield, group: 'intel' },
  { label: 'Settings', path: '/settings', icon: Settings, group: 'system' },
]

const groupLabels: Record<string, string> = {
  main: 'OPERATIONS',
  analysis: 'ANALYSIS',
  intel: 'INTELLIGENCE',
  system: 'SYSTEM',
}

export function Sidebar() {
  const { user } = useAuthStore()
  const location = useLocation()

  const groups = ['main', 'analysis', 'intel', 'system']

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'ST'

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-line flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-line shrink-0">
        <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/30 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4V8C14 11.3 11.3 14 8 15C4.7 14 2 11.3 2 8V4L8 1Z" stroke="#00D6C9" strokeWidth="1.5" fill="none"/>
            <circle cx="8" cy="8" r="2" fill="#00D6C9"/>
            <path d="M8 5V8M8 8L10 10" stroke="#00D6C9" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <span className="text-xs font-bold tracking-widest text-teal font-mono">SHADOW</span>
          <span className="text-xs font-bold tracking-widest text-soft font-mono">TRACE</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {groups.map((group) => {
          const items = navItems.filter((i) => i.group === group)
          return (
            <div key={group}>
              <div className="px-2 mb-2">
                <span className="text-[9px] font-bold tracking-widest text-faint font-mono">
                  {groupLabels[group]}
                </span>
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    item.path === '/dashboard'
                      ? location.pathname === '/dashboard'
                      : location.pathname.startsWith(item.path)

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group relative',
                        isActive
                          ? 'bg-teal/10 text-teal'
                          : 'text-muted hover:text-soft hover:bg-surface'
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal rounded-full" />
                      )}
                      <item.icon
                        size={15}
                        className={cn(
                          'shrink-0 transition-colors',
                          isActive ? 'text-teal' : 'text-muted group-hover:text-soft'
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isActive && (
                        <ChevronRight size={12} className="text-teal/50 shrink-0" />
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="border-t border-line p-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-teal font-mono">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-soft truncate">
              {user?.full_name ?? 'Analyst'}
            </p>
            <p className="text-[10px] text-muted truncate">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
