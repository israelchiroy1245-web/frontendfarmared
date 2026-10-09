import { getToken, getUser } from './auth'

/** Quién puede entrar al módulo. El API sigue siendo quien responde 403. */
export const MODULOS = {
  tablero: ['ADMIN', 'QF', 'AUDITOR'],
  sucursales: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'CALL_CENTER', 'ENCARGADO'],
  inventario: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'ENCARGADO'],
  compras: ['ADMIN', 'QF', 'ENCARGADO'],
  proveedores: ['ADMIN', 'QF', 'AUDITOR', 'ENCARGADO'],
  medicamentos: ['ADMIN', 'QF', 'AUDITOR', 'ENCARGADO'],
  ventas: ['ADMIN', 'CAJERO', 'AUDITOR', 'ENCARGADO'],
  transferencias: ['ADMIN', 'QF', 'AUDITOR', 'ENCARGADO'],
  caja: ['ADMIN', 'CAJERO', 'AUDITOR', 'ENCARGADO'],
  activos: ['ADMIN', 'QF', 'AUDITOR'],
  planilla: ['ADMIN', 'AUDITOR'],
  entregas: ['ADMIN', 'CAJERO', 'QF', 'AUDITOR', 'CALL_CENTER', 'ENCARGADO'],
  callCenter: ['ADMIN', 'CALL_CENTER'],
  reportes: ['ADMIN', 'QF', 'AUDITOR'],
  usuarios: ['ADMIN'],
  roles: ['ADMIN'],
}

const INICIO = {
  ADMIN: '/',
  CAJERO: '/ventas',
  QF: '/inventario',
  ENCARGADO: '/inventario',
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

export function sucursalAsignada() {
  const user = getUser()
  const id = user?.sucursalId ?? user?.sucursal_id ?? user?.SUCURSAL_ID
  return id == null || id === '' ? '' : String(id)
}

export function sucursalFijada() {
  const r = getRol()
  return r === 'CAJERO' || r === 'ENCARGADO' || r === 'QF'
}
