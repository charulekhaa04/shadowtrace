import React from 'react'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <TopNav />
      <main className="ml-60 pt-16 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout
