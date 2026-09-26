import { api } from './api'

export async function login({ usuario, password }) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: { email: usuario, password },
  })

  const token =
    data?.token || data?.access_token || data?.accessToken || data?.data?.token

  if (!token) {
    throw new Error('El servidor no devolvió una sesión')
  }

  localStorage.setItem('token', token)

  const user = data?.usuario || data?.user
  if (user) {
    localStorage.setItem('user', JSON.stringify(user))
  }

  return data
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

export function getToken() {
  return localStorage.getItem('token')
}
