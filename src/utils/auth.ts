import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  isAuthenticated: boolean
  setToken: (token: string) => void
  clearToken: () => void
  verifyToken: (token: string) => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: true }),
      clearToken: () => set({ token: null, isAuthenticated: false }),
      verifyToken: async (token) => {
        try {
          const res = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
          if (res.ok) {
            set({ token, isAuthenticated: true })
            return true
          }
          return false
        } catch {
          return false
        }
      },
    }),
    { name: 'auth-store' }
  )
)

// 带认证的 fetch 工具函数
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { token } = useAuthStore.getState()
  const headers = new Headers(options.headers)
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  
  return fetch(url, { ...options, headers })
}
