const API_ROOT = import.meta.env.VITE_API_ROOT ?? 'http://localhost:3001/api'
const AUTH_BASE_URL = `${API_ROOT}/auth`
const MOODBOARD_BASE_URL = `${API_ROOT}/moodboards`
const AI_BASE_URL = `${API_ROOT}/ai`

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

async function request(url, options = {}) {
  const token = getToken()
  let res

  try {
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    const err = new Error(
      `Cannot reach the backend at ${API_ROOT}. Make sure the Flask server is running on port 3001.`,
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
  const data = await request(`${AUTH_BASE_URL}/signup`, {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export async function login({ email, password }) {
  const data = await request(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  setUser(data.user)
  return data
}

export async function logout() {
  try {
    await request(`${AUTH_BASE_URL}/logout`, { method: 'POST' })
  } finally {
    clearToken()
  }
}

export async function getMe() {
  const data = await request(`${AUTH_BASE_URL}/me`)
  if (data.user) {
    setUser(data.user)
  }
  return data
}

export async function getMoodboards() {
  const data = await request(MOODBOARD_BASE_URL)
  return data.moodboards ?? []
}

export async function getMoodboard(moodboardId) {
  const data = await request(`${MOODBOARD_BASE_URL}/${moodboardId}`)
  return data.moodboard
}

export async function saveMoodboard(payload, moodboardId = null) {
  const url = moodboardId ? `${MOODBOARD_BASE_URL}/${moodboardId}` : MOODBOARD_BASE_URL
  const method = moodboardId ? 'PUT' : 'POST'
  const data = await request(url, {
    method,
    body: JSON.stringify(payload),
  })
  return data.moodboard
}

export async function askStyleAssistant({
  prompt,
  items = [],
  outfits = [],
  preferences = [],
  boardTitle = '',
}) {
  const data = await request(`${AI_BASE_URL}/style-chat`, {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      items,
      outfits,
      preferences,
      boardTitle,
    }),
  })

  return data.response
}

export function isAuthenticated() {
  return Boolean(getToken())
}
