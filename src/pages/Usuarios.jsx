import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Shield,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Buscador from '@/components/Buscador'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, fmtDate, gtq } from '@/lib/utils'
import { useDebounced } from '@/lib/useDebounced'
import Paginacion from '@/components/Paginacion'

/** Oracle puede devolver columnas en mayúsculas o como en el SELECT. */
function field(row, ...keys) {
  if (!row) return null
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key]
    const upper = key.toUpperCase()
    if (row[upper] != null && row[upper] !== '') return row[upper]
    const lower = key.toLowerCase()
    if (row[lower] != null && row[lower] !== '') return row[lower]
  }
  return null
}

function isActivo(estado) {
  if (estado == null) return false
  const v = String(estado).toLowerCase()
  return v === '1' || v === 'activo' || v === 'a' || v === 'true'
}

const emptyForm = {
  nombre: '',
  apellido: '',
  email: '',
  dpi: '',
  telefono: '',
  password: '',
  rolId: '',
  estado: 'ACTIVO',
  cargo: '',
  salario: '',
  sucursalId: '',
}

function formFromUsuario(u) {
  return {
    nombre: field(u, 'Nombre') || '',
    apellido: field(u, 'Apellido') || '',
    email: field(u, 'Email') || '',
    dpi: String(field(u, 'DPI', 'Dpi') || ''),
    telefono: field(u, 'Telefono') || '',
    password: '',
    rolId: String(field(u, 'Rol_ID', 'Roles_ID', 'ROL_ID') || ''),
    estado: String(field(u, 'Estado') || 'ACTIVO').toUpperCase(),
    cargo: field(u, 'Cargo') || '',
    salario: field(u, 'Salario') != null ? String(field(u, 'Salario')) : '',
    sucursalId: String(field(u, 'Sucursal_ID', 'SUCURSAL_ID') || ''),
  }
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        <div className="rounded-md bg-secondary p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-semibold">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function UsuariosSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [sucursalFiltro, setSucursalFiltro] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [resumen, setResumen] = useState({ activos: 0, roles: 0, conSucursal: 0 })
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create') // create | edit
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordId, setPasswordId] = useState(null)
  const [passwordValue, setPasswordValue] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadUsuarios = useCallback(async () => {
    const query = { limit, offset }
    if (qDebounced.trim()) query.q = qDebounced.trim()
    if (sucursalFiltro) query.sucursalId = sucursalFiltro
    const data = await api('/api/usuarios', { query })
    setUsuarios(Array.isArray(data?.usuarios) ? data.usuarios : [])
    setTotal(Number(data?.paginacion?.total ?? 0))
    setResumen({
      activos: Number(data?.resumen?.activos ?? 0),
      roles: Number(data?.resumen?.roles ?? 0),
      conSucursal: Number(data?.resumen?.conSucursal ?? 0),
    })
  }, [limit, offset, qDebounced, sucursalFiltro])

  useEffect(() => {
    setOffset(0)
  }, [qDebounced, limit, sucursalFiltro])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [rolesRes, sucRes] = await Promise.all([
          api('/api/catalogos/roles').catch(() => null),
          api('/api/catalogos/sucursales').catch(() => null),
        ])
        if (!alive) return
        setRoles(Array.isArray(rolesRes?.datos) ? rolesRes.datos : [])
        setSucursales(Array.isArray(sucRes?.datos) ? sucRes.datos : [])
      } catch (e) {
        if (alive) setError(e.message)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await loadUsuarios()
        if (alive) setError(null)
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadUsuarios])

  const filtrados = usuarios

  const stats = {
    total,
    activos: resumen.activos,
    inactivos: Math.max(0, total - resumen.activos),
    conSucursal: resumen.conSucursal,
    roles: resumen.roles,
  }

  function setFormField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setFormMode('create')
    setEditId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  async function openEdit(id) {
    setFormMode('edit')
    setEditId(id)
    setSaving(true)
    try {
      const data = await api(`/api/usuarios/${id}`)
      setForm(formFromUsuario(data.usuario))
      setFormOpen(true)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar el usuario')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const data = await api(`/api/usuarios/${id}`)
      setDetail(data.usuario)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar el detalle')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function openPassword(id) {
    setPasswordId(id)
    setPasswordValue('')
    setPasswordOpen(true)
  }

  function openDelete(u) {
    setDeleteTarget(u)
    setDeleteOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (formMode === 'create') {
        if (!form.nombre || !form.apellido || !form.email || !form.dpi || !form.password || !form.rolId) {
          toast.error('nombre, apellido, email, dpi, rol y password son obligatorios')
          return
        }
        if (form.password.length < 6) {
          toast.error('La contraseña debe tener al menos 6 caracteres')
          return
        }

        const body = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          dpi: form.dpi.trim(),
          telefono: form.telefono.trim() || undefined,
          password: form.password,
          rol: Number(form.rolId),
        }

        if (form.cargo && form.salario && form.sucursalId) {
          body.cargo = form.cargo.trim()
          body.salario = Number(form.salario)
          body.sucursalId = Number(form.sucursalId)
        }

        await api('/api/usuarios', { method: 'POST', body })
        toast.success('Usuario creado exitosamente')
      } else {
        const body = {
          nombre: form.nombre.trim(),
          apellido: form.apellido.trim(),
          email: form.email.trim(),
          dpi: form.dpi.trim(),
          telefono: form.telefono,
          rolId: form.rolId ? Number(form.rolId) : undefined,
          estado: form.estado,
        }
        if (form.cargo) body.cargo = form.cargo.trim()
        if (form.salario !== '') body.salario = Number(form.salario)
        if (form.sucursalId) body.sucursalId = Number(form.sucursalId)

        await api(`/api/usuarios/${editId}`, { method: 'PUT', body })
        toast.success('Usuario actualizado exitosamente')
      }

      setFormOpen(false)
      await loadUsuarios()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handlePassword(e) {
    e.preventDefault()
    if (!passwordValue || passwordValue.length < 6) {
      toast.error('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    try {
      await api(`/api/usuarios/${passwordId}/password`, {
        method: 'PATCH',
        body: { password: passwordValue },
      })
      toast.success('Contraseña actualizada exitosamente')
      setPasswordOpen(false)
    } catch (err) {
      toast.error(err.message || 'No se pudo cambiar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID', 'Id')
    if (!id) return
    setSaving(true)
    try {
      const empleadoId = field(deleteTarget, 'EMPLEADO_ID', 'Empleado_ID')
      if (!empleadoId) {
        toast.error('Esta cuenta no tiene empleado para inactivar')
        setSaving(false)
        return
      }
      await api(`/api/empleados/${empleadoId}/estado`, { method: 'PATCH', body: { estado: 'INACTIVO' } })
      toast.success('Usuario desactivado exitosamente')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadUsuarios()
    } catch (err) {
      toast.error(err.message || 'No se pudo desactivar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <UsuariosSkeleton />

  if (error) {
    return <p className="text-destructive">No se pudieron cargar los usuarios: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Usuarios</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Personal de la red FarmaRed: cuentas, roles, cargo y sucursal asignada.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Users}
          label="Usuarios registrados"
          value={stats.total}
          hint={sucursalFiltro ? 'Empleados de la sucursal filtrada' : 'Total en F_Usuarios'}
        />
        <Kpi icon={UserCheck} label="Activos" value={stats.activos} hint={`${stats.inactivos} inactivos`} />
        <Kpi icon={Shield} label="Roles distintos" value={stats.roles} hint="Catálogo de F_Roles" />
        <Kpi
          icon={Building2}
          label="Con sucursal"
          value={stats.conSucursal}
          hint="Empleados vinculados a F_Sucursal"
        />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Directorio de usuarios</CardTitle>
            <CardDescription>
              {total} registros
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <select
              className={`${selectClass} sm:w-64`}
              aria-label="Sucursal"
              value={sucursalFiltro}
              onChange={(e) => setSucursalFiltro(e.target.value)}
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => {
                const id = field(s, 'ID', 'Id')
                const codigo = field(s, 'Codigo', 'codigo')
                const nombre = field(s, 'Nombre', 'nombre')
                return (
                  <option key={id} value={id}>
                    {codigo ? `${codigo} · ${nombre}` : nombre}
                  </option>
                )
              })}
            </select>
            <Buscador
              value={q}
              onChange={setQ}
              placeholder="Buscar nombre, email, rol…"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {sucursalFiltro
                ? 'No hay empleados en esa sucursal.'
                : 'No hay usuarios que coincidan con la búsqueda.'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Empleo</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Salario</TableHead>
                  <TableHead>Ingreso</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((u) => {
                  const id = field(u, 'ID', 'Id')
                  const nombre = field(u, 'Nombre') || '—'
                  const apellido = field(u, 'Apellido') || ''
                  const email = field(u, 'Email')
                  const dpi = field(u, 'DPI', 'Dpi')
                  const telefono = field(u, 'Telefono', 'Teléfono')
                  const rol = field(u, 'Rol')
                  const cargo = field(u, 'Cargo')
                  const sucursal = field(u, 'Sucursal')
                  const salario = field(u, 'Salario')
                  const ingreso = field(u, 'Fecha_ingreso', 'FECHA_INGRESO')
                  const estado = field(u, 'Estado')
                  const activo = isActivo(estado)

                  return (
                    <TableRow key={id ?? `${email}-${dpi}`}>
                      <TableCell>
                        <p className="font-medium">
                          {nombre} {apellido}
                        </p>
                        <p className="text-xs text-muted-foreground">DPI {dpi || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{email || '—'}</p>
                        <p className="text-xs text-muted-foreground">{telefono || 'Sin teléfono'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rol || 'Sin rol'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{cargo || '—'}</TableCell>
                      <TableCell className="text-sm">{sucursal || '—'}</TableCell>
                      <TableCell className="text-sm">{salario != null ? gtq(salario) : '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{ingreso ? new Date(ingreso).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={activo ? 'ok' : 'danger'}>
                          {activo ? 'Activo' : String(estado ?? 'Inactivo')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Ver" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={() => openEdit(id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Cambiar contraseña"
                            onClick={() => openPassword(id)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {activo ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Desactivar"
                              onClick={() => openDelete(u)}
                            >
                              <UserX className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <Paginacion
            total={total}
            limit={limit}
            offset={offset}
            onChange={({ limit: nextLimit, offset: nextOffset }) => {
              setLimit(nextLimit)
              setOffset(nextOffset)
            }}
          />
        </CardContent>
      </Card>

      {/* Crear / Editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</DialogTitle>
            <DialogDescription>
              {formMode === 'create'
                ? 'Alta de cuenta. Cargo, salario y sucursal crean el empleado vinculado.'
                : 'Actualiza datos del usuario y, si aplica, del empleado asociado.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="nombre" label="Nombre *">
                <Input id="nombre" value={form.nombre} onChange={(e) => setFormField('nombre', e.target.value)} required />
              </Field>
              <Field id="apellido" label="Apellido *">
                <Input
                  id="apellido"
                  value={form.apellido}
                  onChange={(e) => setFormField('apellido', e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field id="email" label="Email *">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setFormField('email', e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="dpi" label="DPI *">
                <Input id="dpi" value={form.dpi} onChange={(e) => setFormField('dpi', e.target.value)} required />
              </Field>
              <Field id="telefono" label="Teléfono">
                <Input id="telefono" value={form.telefono} onChange={(e) => setFormField('telefono', e.target.value)} />
              </Field>
            </div>
            <Field id="rolId" label="Rol *">
              <select
                id="rolId"
                className={selectClass}
                value={form.rolId}
                onChange={(e) => {
                  const rolId = e.target.value
                  const elegido = roles.find((r) => String(field(r, 'ID', 'Id')) === rolId)
                  const nombre = String(field(elegido, 'Nombre', 'nombre') || '').toUpperCase()
                  setForm((prev) => ({
                    ...prev,
                    rolId,
                    cargo: nombre === 'ENCARGADO' ? 'Encargado de sucursal' : prev.cargo,
                  }))
                }}
                required
              >
                <option value="">Selecciona un rol</option>
                {roles.map((r) => {
                  const id = field(r, 'ID', 'Id')
                  const nombre = field(r, 'Nombre', 'nombre')
                  return (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  )
                })}
              </select>
            </Field>

            {formMode === 'create' ? (
              <Field id="password" label="Contraseña *">
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setFormField('password', e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
            ) : (
              <Field id="estado" label="Estado">
                <select
                  id="estado"
                  className={selectClass}
                  value={form.estado}
                  onChange={(e) => setFormField('estado', e.target.value)}
                >
                  <option value="ACTIVO">ACTIVO</option>
                  <option value="INACTIVO">INACTIVO</option>
                </select>
              </Field>
            )}

            <p className="pt-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Empleado (opcional)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="cargo" label="Cargo">
                <Input id="cargo" value={form.cargo} onChange={(e) => setFormField('cargo', e.target.value)} />
              </Field>
              <Field id="salario" label="Salario">
                <Input
                  id="salario"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.salario}
                  onChange={(e) => setFormField('salario', e.target.value)}
                />
              </Field>
            </div>
            <Field id="sucursalId" label="Sucursal">
              <select
                id="sucursalId"
                className={selectClass}
                value={form.sucursalId}
                onChange={(e) => setFormField('sucursalId', e.target.value)}
              >
                <option value="">Sin sucursal</option>
                {sucursales.map((s) => {
                  const id = field(s, 'ID', 'Id')
                  const nombre = field(s, 'Nombre', 'nombre')
                  return (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  )
                })}
              </select>
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : formMode === 'create' ? 'Crear' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detalle */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalle de usuario</DialogTitle>
            <DialogDescription>GET /api/usuarios/:id</DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Nombre</dt>
                <dd className="font-medium text-right">
                  {field(detail, 'Nombre')} {field(detail, 'Apellido')}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-right">{field(detail, 'Email') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">DPI</dt>
                <dd className="text-right">{field(detail, 'DPI') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Teléfono</dt>
                <dd className="text-right">{field(detail, 'Telefono') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rol</dt>
                <dd className="text-right">{field(detail, 'Rol') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cargo</dt>
                <dd className="text-right">{field(detail, 'Cargo') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sucursal</dt>
                <dd className="text-right">{field(detail, 'Sucursal') || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Salario</dt>
                <dd className="text-right">
                  {field(detail, 'Salario') != null ? gtq(field(detail, 'Salario')) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ingreso</dt>
                <dd className="text-right">{fmtDate(field(detail, 'Fecha_ingreso', 'FECHA_INGRESO'))}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Estado</dt>
                <dd>
                  <Badge variant={isActivo(field(detail, 'Estado')) ? 'ok' : 'danger'}>
                    {field(detail, 'Estado') || '—'}
                  </Badge>
                </dd>
              </div>
            </dl>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>Mínimo 6 caracteres. Se envía con PATCH al backend.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePassword} className="grid gap-3">
            <Field id="nuevaPassword" label="Nueva contraseña">
              <Input
                id="nuevaPassword"
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                minLength={6}
                required
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Actualizar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Baja lógica */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desactivar usuario</DialogTitle>
            <DialogDescription>
              Baja lógica: el usuario (y su empleado) pasan a estado INACTIVO. No se elimina el registro.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Desactivar a{' '}
            <span className="font-medium">
              {field(deleteTarget, 'Nombre')} {field(deleteTarget, 'Apellido')}
            </span>
            ?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Desactivando…' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
