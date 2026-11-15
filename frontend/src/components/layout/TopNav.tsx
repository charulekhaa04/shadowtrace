import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, ChevronRight, LogOut, User, Settings } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '../../lib/utils'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'

const breadcrumbMap: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/investigations': 'Investigations',
  '/scanner': 'Threat Scanner',
  '/evidence': 'Evidence Repository',
  '/analysis/network': 'Network Analysis',
  '/analysis/logs': 'Log Analysis',
  '/correlation': 'Evidence Correlation',
  '/timeline': 'Incident Timeline',
  '/ai': 'AI Assistant',
  '/reports': 'Reports',
  '/threat-intel': 'Threat Intel',
  '/settings': 'Settings',
}

export function TopNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')

  const pathSegments = location.pathname.split('/').filter(Boolean)
  const currentPage =
    breadcrumbMap[location.pathname] ??
    pathSegments[pathSegments.length - 1]?.replace(/-/g, ' ') ??
    'Dashboard'

  const isInvestigationDetail =
    pathSegments[0] === 'investigations' && pathSegments.length > 1

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'ST'

  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-sidebar border-b border-line flex items-center px-6 gap-4 z-30">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted flex-1">
        <span
          className="hover:text-soft cursor-pointer transition-colors"
          onClick={() => navigate('/dashboard')}
        >
          SHADOWTRACE
        </span>
        <ChevronRight size={12} className="text-faint" />
        {isInvestigationDetail ? (
          <>
            <span
              className="hover:text-soft cursor-pointer transition-colors"
              onClick={() => navigate('/investigations')}
            >
              Investigations
            </span>
            <ChevronRight size={12} className="text-faint" />
            <span className="text-soft font-medium">Detail</span>
          </>
        ) : (
          <span className="text-soft font-medium">{currentPage}</span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Quick search..."
          className="pl-9 pr-4 py-1.5 bg-surface border border-line rounded-lg text-xs text-soft placeholder-muted focus:outline-none focus:border-teal/50 focus:bg-card w-56 transition-all"
        />
      </div>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg text-muted hover:text-soft hover:bg-surface transition-colors">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-critical" />
      </button>

      {/* User menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface transition-colors">
            <div className="w-7 h-7 rounded-md bg-teal/10 border border-teal/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-teal font-mono">{initials}</span>
            </div>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[180px] bg-card border border-line-strong rounded-xl shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95"
            align="end"
            sideOffset={8}
          >
            <div className="px-3 py-2 border-b border-line mb-1">
              <p className="text-xs font-semibold text-soft">{user?.full_name}</p>
              <p className="text-[10px] text-muted truncate">{user?.email}</p>
            </div>

            <DropdownMenu.Item
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-soft hover:bg-surface cursor-pointer transition-colors outline-none"
              onClick={() => navigate('/settings')}
            >
              <User size={13} /> Profile
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-soft hover:bg-surface cursor-pointer transition-colors outline-none"
              onClick={() => navigate('/settings')}
            >
              <Settings size={13} /> Settings
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-line" />

            <DropdownMenu.Item
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-critical hover:bg-critical/10 cursor-pointer transition-colors outline-none"
              onClick={logout}
            >
              <LogOut size={13} /> Sign Out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  )
}

export default TopNav
