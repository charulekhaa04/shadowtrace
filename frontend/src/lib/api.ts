import axios from 'axios'
import type {
  AuthTokens,
  LoginCredentials,
  RegisterData,
  User,
  Investigation,
  InvestigationCreate,
  Evidence,
  ScanResult,
  ChatMessage,
  ChatSession,
  ForensicReport,
  TimelineEvent,
  DashboardStats,
  ThreatActivityPoint,
  ThreatDistribution,
  NetworkAnalysisResult,
  LogAnalysisResult,
  CorrelationGraph,
  MitreTechnique,
  ThreatIndicator,
  PaginatedResponse,
  UserProfile,
  PasswordChange,
  ApiKeys,
  NotificationSettings,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor: attach JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/signin'
    }
    return Promise.reject(error)
  }
)

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthTokens> => {
    const form = new URLSearchParams()
    form.append('username', credentials.email)
    form.append('password', credentials.password)
    const { data } = await apiClient.post<AuthTokens>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return data
  },

  register: async (userData: RegisterData): Promise<User> => {
    const { data } = await apiClient.post<User>('/auth/register', userData)
    return data
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me')
    return data
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/auth/forgot-password', { email })
    return data
  },

  resetPassword: async (token: string, new_password: string): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      new_password,
    })
    return data
  },
}

// ─── Investigations ────────────────────────────────────────────────────────
export const investigationsApi = {
  list: async (params?: {
    page?: number
    size?: number
    status?: string
    search?: string
  }): Promise<PaginatedResponse<Investigation>> => {
    const { data } = await apiClient.get<PaginatedResponse<Investigation>>('/investigations', {
      params,
    })
    return data
  },

  get: async (id: string): Promise<Investigation> => {
    const { data } = await apiClient.get<Investigation>(`/investigations/${id}`)
    return data
  },

  create: async (payload: InvestigationCreate): Promise<Investigation> => {
    const { data } = await apiClient.post<Investigation>('/investigations', payload)
    return data
  },

  update: async (id: string, payload: Partial<InvestigationCreate & { status: string }>): Promise<Investigation> => {
    const { data } = await apiClient.put<Investigation>(`/investigations/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/investigations/${id}`)
  },

  getTimeline: async (id: string): Promise<TimelineEvent[]> => {
    const { data } = await apiClient.get<TimelineEvent[]>(`/investigations/${id}/timeline`)
    return data
  },
}

// ─── Evidence ──────────────────────────────────────────────────────────────
export const evidenceApi = {
  list: async (params?: {
    investigation_id?: string
    file_type?: string
    page?: number
    size?: number
  }): Promise<PaginatedResponse<Evidence>> => {
    const { data } = await apiClient.get<PaginatedResponse<Evidence>>('/evidence', { params })
    return data
  },

  get: async (id: string): Promise<Evidence> => {
    const { data } = await apiClient.get<Evidence>(`/evidence/${id}`)
    return data
  },

  upload: async (
    file: File,
    investigationId?: string,
    onProgress?: (pct: number) => void
  ): Promise<Evidence> => {
    const form = new FormData()
    form.append('file', file)
    if (investigationId) form.append('investigation_id', investigationId)
    const { data } = await apiClient.post<Evidence>('/evidence/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    })
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/evidence/${id}`)
  },
}

// ─── Scanner ───────────────────────────────────────────────────────────────
export const scannerApi = {
  scanUrl: async (url: string, investigationId?: string): Promise<ScanResult> => {
    const { data } = await apiClient.post<ScanResult>('/scanner/url', {
      url,
      investigation_id: investigationId,
    })
    return data
  },

  scanEmail: async (
    email_address: string,
    email_content?: string,
    investigationId?: string
  ): Promise<ScanResult> => {
    const { data } = await apiClient.post<ScanResult>('/scanner/email', {
      email_address,
      email_content,
      investigation_id: investigationId,
    })
    return data
  },

  scanIp: async (ip: string, investigationId?: string): Promise<ScanResult> => {
    const { data } = await apiClient.post<ScanResult>('/scanner/ip', {
      ip,
      investigation_id: investigationId,
    })
    return data
  },

  getResults: async (investigationId?: string): Promise<ScanResult[]> => {
    const { data } = await apiClient.get<ScanResult[]>('/scanner/results', {
      params: { investigation_id: investigationId },
    })
    return data
  },
}

// ─── Analysis ──────────────────────────────────────────────────────────────
export const analysisApi = {
  analyzeNetwork: async (
    file: File,
    investigationId?: string,
    onProgress?: (pct: number) => void
  ): Promise<NetworkAnalysisResult> => {
    const form = new FormData()
    form.append('file', file)
    if (investigationId) form.append('investigation_id', investigationId)
    const { data } = await apiClient.post<NetworkAnalysisResult>('/analysis/network-traffic', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    })
    return data
  },

  analyzeLogs: async (
    file: File,
    investigationId?: string,
    onProgress?: (pct: number) => void
  ): Promise<LogAnalysisResult> => {
    const form = new FormData()
    form.append('file', file)
    if (investigationId) form.append('investigation_id', investigationId)
    const { data } = await apiClient.post<LogAnalysisResult>('/analysis/logs', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (evt.total && onProgress) {
          onProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    })
    return data
  },

  getCorrelationGraph: async (investigationId: string): Promise<CorrelationGraph> => {
    const { data } = await apiClient.get<CorrelationGraph>(
      `/ai/correlation/${investigationId}`
    )
    return data
  },
}

// ─── AI Assistant ──────────────────────────────────────────────────────────
export const aiApi = {
  chat: async (
    message: string,
    investigationId?: string,
    sessionId?: string
  ): Promise<ChatMessage> => {
    const { data } = await apiClient.post<ChatMessage>('/ai/chat', {
      message,
      investigation_id: investigationId,
      session_id: sessionId,
    })
    return data
  },

  getSessions: async (investigationId?: string): Promise<ChatSession[]> => {
    const { data } = await apiClient.get<ChatSession[]>('/ai/sessions', {
      params: { investigation_id: investigationId },
    })
    return data
  },

  getSession: async (sessionId: string): Promise<ChatSession> => {
    const { data } = await apiClient.get<ChatSession>(`/ai/sessions/${sessionId}`)
    return data
  },
}

// ─── Reports ───────────────────────────────────────────────────────────────
export const reportsApi = {
  list: async (): Promise<ForensicReport[]> => {
    const { data } = await apiClient.get<ForensicReport[]>('/reports')
    return data
  },

  generate: async (investigationId: string): Promise<ForensicReport> => {
    const { data } = await apiClient.post<ForensicReport>(`/reports/generate/${investigationId}`)
    return data
  },

  get: async (id: string): Promise<ForensicReport> => {
    const { data } = await apiClient.get<ForensicReport>(`/reports/${id}`)
    return data
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const { data } = await apiClient.get(`/reports/${id}/pdf`, { responseType: 'blob' })
    return data
  },
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>('/dashboard/stats')
    return data
  },

  getThreatActivity: async (days = 30): Promise<ThreatActivityPoint[]> => {
    const { data } = await apiClient.get<ThreatActivityPoint[]>('/dashboard/threat-activity', {
      params: { days },
    })
    return data
  },

  getThreatDistribution: async (): Promise<ThreatDistribution[]> => {
    const { data } = await apiClient.get<ThreatDistribution[]>('/dashboard/threat-distribution')
    return data
  },
}

// ─── Threat Intelligence ───────────────────────────────────────────────────
export const threatIntelApi = {
  getMitreTechniques: async (tactic?: string): Promise<MitreTechnique[]> => {
    const { data } = await apiClient.get<MitreTechnique[]>('/threat-intel/mitre', {
      params: { tactic },
    })
    return data
  },

  getIndicators: async (params?: {
    type?: string
    page?: number
    size?: number
  }): Promise<PaginatedResponse<ThreatIndicator>> => {
    const { data } = await apiClient.get<PaginatedResponse<ThreatIndicator>>(
      '/threat-intel/indicators',
      { params }
    )
    return data
  },

  search: async (query: string): Promise<{ results: ThreatIndicator[] }> => {
    const { data } = await apiClient.get<{ results: ThreatIndicator[] }>(
      '/threat-intel/search',
      { params: { q: query } }
    )
    return data
  },
}

// ─── Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  updateProfile: async (payload: Partial<UserProfile>): Promise<User> => {
    const { data } = await apiClient.put<User>('/settings/profile', payload)
    return data
  },

  changePassword: async (payload: PasswordChange): Promise<{ message: string }> => {
    const { data } = await apiClient.post<{ message: string }>('/settings/change-password', payload)
    return data
  },

  getApiKeys: async (): Promise<Partial<ApiKeys>> => {
    const { data } = await apiClient.get<Partial<ApiKeys>>('/settings/api-keys')
    return data
  },

  saveApiKeys: async (payload: Partial<ApiKeys>): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>('/settings/api-keys', payload)
    return data
  },

  getNotifications: async (): Promise<NotificationSettings> => {
    const { data } = await apiClient.get<NotificationSettings>('/settings/notifications')
    return data
  },

  saveNotifications: async (payload: NotificationSettings): Promise<{ message: string }> => {
    const { data } = await apiClient.put<{ message: string }>('/settings/notifications', payload)
    return data
  },
}
