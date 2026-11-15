import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../lib/api'
import toast from 'react-hot-toast'
import type { LoginCredentials, RegisterData } from '../types'

export function useAuth() {
  const { user, accessToken, isAuthenticated, login, logout, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const handleLogin = useCallback(
    async (credentials: LoginCredentials) => {
      const tokens = await authApi.login(credentials)
      const me = await authApi.me()
      login(tokens.access_token, me)
      toast.success(`Welcome back, ${me.full_name}!`)
      navigate('/dashboard')
    },
    [login, navigate]
  )

  const handleRegister = useCallback(
    async (data: RegisterData) => {
      await authApi.register(data)
      await handleLogin({ email: data.email, password: data.password })
    },
    [handleLogin]
  )

  const handleLogout = useCallback(() => {
    logout()
    navigate('/signin')
    toast.success('Signed out successfully')
  }, [logout, navigate])

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      updateUser(me)
    } catch {
      // token invalid - will be caught by interceptor
    }
  }, [updateUser])

  return {
    user,
    accessToken,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    refreshUser,
    updateUser,
  }
}
