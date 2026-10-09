import { api } from './api'
import { getRefreshToken, getToken, getUser, guardarSesion, limpiarSesion } from './sesionCliente'

export { getToken, getUser }

export async function login({ usuario, password }) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { email: usuario, password },
  })

  const token = data?.token || data?.access_token || data?.accessToken || data?.data?.token
  const refreshToken = data?.refreshToken

  if (!token || !refreshToken) {
    throw new Error('El servidor no devolvió una sesión')
  }

  guardarSesion({
    token,
    refreshToken,
    usuario: data?.usuario || data?.user,
  })

  return data
}

export async function logout() {
  const token = getToken()
  const refreshToken = getRefreshToken()
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    })
  } catch {
    /* aunque falle la red, el cliente no conserva la sesión */
  }
  limpiarSesion()
}
