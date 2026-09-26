const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export async function api(path, options = {}) {
  const { body, headers, ...rest } = options
  const token = localStorage.getItem('token')

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { message: text }
    }
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || data?.msg || `Error ${res.status}`
    throw new Error(typeof message === 'string' ? message : 'Error en la solicitud')
  }

  return data
}
