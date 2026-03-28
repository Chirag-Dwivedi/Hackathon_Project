import { AuthProvider, useAuth } from './AuthContext.jsx'
import AuthPage from './AuthPage.jsx'
import Dashboard from './dashboard.jsx'
import './App.css'

function AppContent() {
  const { user, ready } = useAuth()

  if (!ready) return null          // hydrating from localStorage

  return user ? <Dashboard /> : <AuthPage />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
