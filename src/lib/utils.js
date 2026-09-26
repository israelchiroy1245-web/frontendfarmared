export { cn } from 'cn'
export { api } from './api'

export function gtq(value) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
  }).format(Number.isFinite(n) ? n : 0)
}
