import { createContext, useContext, useEffect, useState } from 'react'
import { getMe, getStoredUser, isAuthenticated, logout as apiLogout } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydrateAuth() {
      if (!isAuthenticated()) {
        if (!cancelled) setReady(true)
        return
      }

      const cachedUser = getStoredUser()
      if (cachedUser && !cancelled) {
        setUser(cachedUser)
      }

      try {
        const { user: freshUser } = await getMe()
        if (!cancelled) {
          setUser(freshUser)
        }
      } catch {
        try {
          await apiLogout()
        } finally {
          if (!cancelled) {
            setUser(null)
          }
        }
      } finally {
        if (!cancelled) {
          setReady(true)
        }
      }
    }

    hydrateAuth()

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, onLogin: handleLogin, onLogout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
