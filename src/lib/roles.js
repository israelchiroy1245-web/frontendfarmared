import { getToken, getUser } from './auth'

/** Quién puede entrar al módulo. El API sigue siendo quien responde 403. */
export const MODULOS = {
  tablero: ['ADMIN', 'QF', 'AUDITOR'],
  sucursales: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'CALL_CENTER'],
  inventario: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'CALL_CENTER'],
  compras: ['ADMIN', 'QF', 'AUDITOR'],
  proveedores: ['ADMIN', 'QF', 'AUDITOR'],
  ventas: ['ADMIN', 'CAJERO', 'AUDITOR'],
  transferencias: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR'],
  caja: ['ADMIN', 'CAJERO', 'AUDITOR'],
  activos: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR'],
  planilla: ['ADMIN', 'AUDITOR'],
  entregas: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'CALL_CENTER'],
  callCenter: ['ADMIN', 'CALL_CENTER'],
  reportes: ['ADMIN', 'QF', 'AUDITOR'],
  usuarios: ['ADMIN'],
  roles: ['ADMIN'],
  permisos: ['ADMIN'],
}

const INICIO = {
  ADMIN: '/',
  CAJERO: '/ventas',
  QF: '/inventario',
  AUDITOR: '/caja',
  CALL_CENTER: '/call-center',
}

function nombreRol(valor) {
  if (valor == null || valor === '') return ''
  if (typeof valor === 'object') {
    return nombreRol(valor.nombre || valor.Nombre || valor.name || valor.rol)
  }
  const texto = String(valor).trim().toUpperCase()
  if (!texto || !Number.isNaN(Number(texto))) return ''
  return texto
}

function leerJwt() {
  const token = getToken()
  if (!token) return null
  const parte = token.split('.')[1]
  if (!parte) return null
  try {
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getRol() {
  const user = getUser()
  const desdeUsuario = nombreRol(
    user?.rol || user?.Rol || user?.ROL || user?.role || user?.rolNombre || user?.nombreRol,
  )
  if (desdeUsuario) return desdeUsuario
  const jwt = leerJwt()
  return nombreRol(jwt?.rol || jwt?.Rol || jwt?.role)
}

export function puedeModulo(modulo, rol = getRol()) {
  const lista = MODULOS[modulo]
  if (!lista) return false
  return lista.includes(String(rol || '').toUpperCase())
}

export function inicioDe(rol = getRol()) {
  return INICIO[String(rol || '').toUpperCase()] || '/'
}
