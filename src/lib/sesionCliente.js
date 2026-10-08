const TOKEN = 'token'
const REFRESH = 'refreshToken'
const USER = 'user'

function borrar(store) {
  store.removeItem(TOKEN)
  store.removeItem(REFRESH)
  store.removeItem(USER)
}

export function guardarSesion({ token, refreshToken, usuario }) {
  sessionStorage.setItem(TOKEN, token)
  if (refreshToken) sessionStorage.setItem(REFRESH, refreshToken)
  if (usuario) sessionStorage.setItem(USER, JSON.stringify(usuario))
  borrar(localStorage)
}

export function limpiarSesion() {
  borrar(sessionStorage)
  borrar(localStorage)
}

export function getToken() {
  return sessionStorage.getItem(TOKEN)
}

export function getRefreshToken() {
  return sessionStorage.getItem(REFRESH)
}

export function getUser() {
  try {
    const raw = sessionStorage.getItem(USER)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function guardarTokens(token, refreshToken) {
  if (token) sessionStorage.setItem(TOKEN, token)
  if (refreshToken) sessionStorage.setItem(REFRESH, refreshToken)
}
