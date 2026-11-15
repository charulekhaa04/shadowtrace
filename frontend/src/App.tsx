import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Auth pages
import WelcomePage from './pages/auth/WelcomePage'
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

// App pages
import DashboardPage from './pages/DashboardPage'
import InvestigationsPage from './pages/investigations/InvestigationsPage'
import InvestigationDetailPage from './pages/investigations/InvestigationDetailPage'
import ThreatScannerPage from './pages/scanner/ThreatScannerPage'
import EvidenceRepositoryPage from './pages/evidence/EvidenceRepositoryPage'
import NetworkAnalysisPage from './pages/analysis/NetworkAnalysisPage'
import LogAnalysisPage from './pages/analysis/LogAnalysisPage'
import CorrelationPage from './pages/correlation/CorrelationPage'
import TimelinePage from './pages/timeline/TimelinePage'
import AIAssistantPage from './pages/ai/AIAssistantPage'
import ReportsPage from './pages/reports/ReportsPage'
import ThreatIntelPage from './pages/threat-intel/ThreatIntelPage'
import SettingsPage from './pages/SettingsPage'

import AppLayout from './components/layout/AppLayout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/signin" replace />
  return <>{children}</>
}

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111B2B',
            color: '#E8EEF7',
            border: '1px solid #243550',
          },
          success: { iconTheme: { primary: '#35C98A', secondary: '#111B2B' } },
          error: { iconTheme: { primary: '#FF4757', secondary: '#111B2B' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <WelcomePage />} />
        <Route path="/signin" element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignInPage />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/dashboard" /> : <SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected */}
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="investigations" element={<InvestigationsPage />} />
          <Route path="investigations/:id" element={<InvestigationDetailPage />} />
          <Route path="scanner" element={<ThreatScannerPage />} />
          <Route path="evidence" element={<EvidenceRepositoryPage />} />
          <Route path="analysis/network" element={<NetworkAnalysisPage />} />
          <Route path="analysis/logs" element={<LogAnalysisPage />} />
          <Route path="correlation" element={<CorrelationPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="ai" element={<AIAssistantPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="threat-intel" element={<ThreatIntelPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
