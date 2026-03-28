import { createContext, useContext, useEffect, useState } from 'react'
import { getStoredUser, isAuthenticated, logout as apiLogout } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Hydrate from localStorage on mount
    if (isAuthenticated()) {
      setUser(getStoredUser())
    }
    setReady(true)
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
