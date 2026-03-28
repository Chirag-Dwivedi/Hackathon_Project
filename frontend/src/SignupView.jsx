import { useState } from 'react'
import { signup } from './api.js'
import { useAuth } from './AuthContext.jsx'
import './auth.css'

const PW_RULES = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
]

function StrengthBar({ password }) {
  const passed = PW_RULES.filter((r) => r.test(password)).length
  const pct = password ? (passed / PW_RULES.length) * 100 : 0
  const label = pct === 0 ? '' : pct < 50 ? 'Weak' : pct < 100 ? 'Good' : 'Strong'
  const color = pct < 50 ? '#c0614d' : pct < 100 ? '#b88d67' : '#6f7b58'

  return (
    <div className="auth-strength">
      <div className="auth-strength-bar">
        <div
          className="auth-strength-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="auth-strength-label" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

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

export default function SignupView({ onSwitch }) {
  const { onLogin } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [field]: '' }))
    if (error) setError('')
  }

  const validate = () => {
    const fe = {}
    if (form.name.trim().length < 2) fe.name = 'Name must be at least 2 characters'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) fe.email = 'Enter a valid email'
    const failedRules = PW_RULES.filter((r) => !r.test(form.password))
    if (failedRules.length) fe.password = `Password needs: ${failedRules.map((r) => r.label).join(', ')}`
    if (form.password !== form.confirm) fe.confirm = 'Passwords do not match'
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError('')
    try {
      const { user } = await signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      onLogin(user)
    } catch (err) {
      setError(err.message || 'Sign up failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-card auth-card--signup">
      {/* Side editorial panel */}
      <aside className="auth-editorial auth-editorial--left" aria-hidden="true">
        <div className="auth-editorial-inner">
          <div className="auth-editorial-tags">
            <span className="auth-tag">minimal tailoring</span>
            <span className="auth-tag">soft glam</span>
            <span className="auth-tag">neutral layers</span>
            <span className="auth-tag">structured coats</span>
            <span className="auth-tag">earth tones</span>
          </div>
          <blockquote className="auth-quote">
            "Fashion is the armor to survive the reality of everyday life."
          </blockquote>
          <p className="auth-quote-attr">— Bill Cunningham</p>
        </div>
      </aside>

      <div className="auth-inner">
        <div className="auth-accent" aria-hidden="true">
          <span className="auth-spark">✦</span>
        </div>

        <header className="auth-header">
          <div className="auth-brand">Sleeves</div>
          <p className="auth-tagline">Build your personal style universe</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-name">Full name</label>
            <input
              id="signup-name"
              className={`auth-input ${fieldErrors.name ? 'auth-input--error' : ''}`}
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={form.name}
              onChange={set('name')}
              disabled={loading}
            />
            {fieldErrors.name && <p className="auth-field-error">{fieldErrors.name}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              className={`auth-input ${fieldErrors.email ? 'auth-input--error' : ''}`}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              disabled={loading}
            />
            {fieldErrors.email && <p className="auth-field-error">{fieldErrors.email}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-password">Password</label>
            <div className="auth-input-wrap">
              <input
                id="signup-password"
                className={`auth-input ${fieldErrors.password ? 'auth-input--error' : ''}`}
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
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
            {form.password && <StrengthBar password={form.password} />}
            {fieldErrors.password && (
              <p className="auth-field-error">{fieldErrors.password}</p>
            )}
            <ul className="auth-rules">
              {PW_RULES.map((rule) => (
                <li
                  key={rule.label}
                  className={`auth-rule ${rule.test(form.password) ? 'auth-rule--pass' : ''}`}
                >
                  <span className="auth-rule-dot" />
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-confirm">Confirm password</label>
            <div className="auth-input-wrap">
              <input
                id="signup-confirm"
                className={`auth-input ${fieldErrors.confirm ? 'auth-input--error' : ''}`}
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={set('confirm')}
                disabled={loading}
              />
              <button
                type="button"
                className="auth-eye"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {fieldErrors.confirm && (
              <p className="auth-field-error">{fieldErrors.confirm}</p>
            )}
          </div>

          {error && (
            <p className="auth-error" role="alert">{error}</p>
          )}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="auth-spinner" aria-hidden="true" />
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button type="button" className="auth-link" onClick={onSwitch}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
