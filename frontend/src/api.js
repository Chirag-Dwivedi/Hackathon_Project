const BASE_URL = 'http://localhost:3001/api/auth'

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
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  const data = await res.json()
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
  return request('/me')
}

export function isAuthenticated() {
  return Boolean(getToken())
}
