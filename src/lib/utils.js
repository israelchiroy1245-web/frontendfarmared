import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function gtq(n) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

export function fmtDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).replace('T', ' ').slice(0, 16)
  return d.toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })
}

export function downloadCsv(filename, rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => esc(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(',')).join('\n')
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function api(path, options = {}) {
  const { method = 'GET', body, query, headers } = options
  const url = new URL(path, window.location.origin)
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v != null && v !== '') url.searchParams.set(k, v)
    })
  }

  const token = localStorage.getItem('token')
  const res = await fetch(url.pathname + url.search, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && token && !String(path).includes('/api/auth/login')) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') {
      window.location.assign('/login')
    }
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || data.msg || `Error ${res.status}`)
  }
  return data
}