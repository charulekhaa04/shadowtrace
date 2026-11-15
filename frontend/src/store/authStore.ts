import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient, authApi } from '../lib/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email, password) => {
        // Use JSON login endpoint
        const { data } = await apiClient.post('/auth/login', { email, password })
        const { access_token, refresh_token } = data
        localStorage.setItem('access_token', access_token)
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
        const user = await authApi.me()
        set({ user, accessToken: access_token, isAuthenticated: true })
      },

      register: async (email, password, fullName) => {
        await apiClient.post('/auth/register', { email, password, full_name: fullName })
        await get().login(email, password)
      },

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, isAuthenticated: false })
      },

      refreshUser: async () => {
        try {
          const user = await authApi.me()
          set({ user, isAuthenticated: true })
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'shadowtrace-auth',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    }
  )
)
