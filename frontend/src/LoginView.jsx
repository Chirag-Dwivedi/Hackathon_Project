import { useState } from 'react'
import { login } from './api.js'
import { useAuth } from './AuthContext.jsx'
import './auth.css'

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function LoginView({ onSwitch }) {
  const { onLogin } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { user } = await login(form)
      onLogin(user)
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card auth-card--login">
      <div className="auth-inner">
        {/* Decorative accent */}
        <div className="auth-accent" aria-hidden="true">
          <span className="auth-spark">*</span>
        </div>

        <header className="auth-header">
          <div className="auth-brand">Sleeves</div>
          <p className="auth-tagline">Welcome back — your board awaits</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className={`auth-input ${error ? 'auth-input--error' : ''}`}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="login-password">Password</label>
            <div className="auth-input-wrap">
              <input
                id="login-password"
                className={`auth-input ${error ? 'auth-input--error' : ''}`}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                disabled={loading}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">{error}</p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" aria-hidden="true" />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className="auth-switch">
          New to Sleeves?{' '}
          <button type="button" className="auth-link" onClick={onSwitch}>
            Create an account
          </button>
        </p>
      </div>

      {/* Side editorial panel */}
      <aside className="auth-editorial" aria-hidden="true">
        <div className="auth-editorial-inner">
          <blockquote className="auth-quote">
            "Style is a way to say who you are without having to speak."
          </blockquote>
          <p className="auth-quote-attr">— Rachel Zoe</p>
          <div className="auth-pill-row">
            <span className="auth-pill">earth tones</span>
            <span className="auth-pill">structured coats</span>
            <span className="auth-pill">soft glam</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
