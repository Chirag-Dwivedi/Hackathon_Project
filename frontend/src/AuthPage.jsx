import { useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import LoginView from './LoginView.jsx'
import SignupView from './SignupView.jsx'
import './auth.css'

export default function AuthPage() {
  const { user, onLogout } = useAuth()
  const [mode, setMode] = useState('login')

  // Already logged in — show a mini welcome card
  if (user) {
    return (
      <div className="auth-welcome">
        <div className="auth-welcome-card">
          <div className="auth-welcome-orb" aria-hidden="true" />
          <h2 className="auth-welcome-name">Hi, {user.name.split(' ')[0]}.</h2>
          <p className="auth-welcome-email">{user.email}</p>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.92rem' }}>
            You're signed in to Sleeves. Head to your board to start pinning.
          </p>
          <button className="auth-logout" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      {mode === 'login' ? (
        <LoginView onSwitch={() => setMode('signup')} />
      ) : (
        <SignupView onSwitch={() => setMode('login')} />
      )}
    </div>
  )
}
