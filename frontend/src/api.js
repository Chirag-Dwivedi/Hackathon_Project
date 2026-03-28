const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api/auth'

function getToken() {
  return localStorage.getItem('sleeves_token')
}

function setToken(token) {
  localStorage.setItem('sleeves_token', token)
}

function clearToken() {
  localStorage.removeItem('sleeves_token')
  localStorage.removeItem('sleeves_user')
}

function setUser(user) {
  localStorage.setItem('sleeves_user', JSON.stringify(user))
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('sleeves_user') ?? 'null')
  } catch {
    return null
  }
}

async function request(path, options = {}) {
  const token = getToken()
  let res

  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    const err = new Error(
      `Cannot reach the backend at ${BASE_URL}. Make sure the Flask server is running on port 3001.`,
    )
    err.cause = error
    throw err
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed')
    err.details = data.details
    err.status = res.status
    throw err
  }
  return data
}

export async function signup({ name, email, password }) {
  const data = await request('/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export async function login({ email, password }) {
  const data = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export async function logout() {
  try {
    await request('/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}

export async function getMe() {
  const data = await request('/me')
  if (data.user) {
    setUser(data.user)
  }
  return data
}

export function isAuthenticated() {
  return Boolean(getToken())
}
