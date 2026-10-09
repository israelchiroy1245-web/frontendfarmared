import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  Pencil,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
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
import { api } from '@/lib/utils'
import { useDebounced } from '@/lib/useDebounced'
import Paginacion from '@/components/Paginacion'

const ROLES_PROTEGIDOS = ['ADMIN', 'CAJERO', 'AUDITOR', 'CALL_CENTER', 'QF']

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

function isProtegido(nombre) {
  if (!nombre) return false
  return ROLES_PROTEGIDOS.includes(String(nombre).toUpperCase())
}

const emptyForm = {
  nombre: '',
  descripcion: '',
}

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

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

function RolesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

export default function Roles() {
  const [roles, setRoles] = useState([])
  const [catalogoPermisos, setCatalogoPermisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [resumen, setResumen] = useState({ usuarios: 0, protegidos: 0 })
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadRoles = useCallback(async () => {
    const query = { limit, offset }
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/roles', { query })
    setRoles(Array.isArray(data?.roles) ? data.roles : [])
    setTotal(Number(data?.paginacion?.total ?? 0))
    setResumen({
      usuarios: Number(data?.resumen?.usuarios ?? 0),
      protegidos: Number(data?.resumen?.protegidos ?? 0),
    })
  }, [limit, offset, qDebounced])

  useEffect(() => {
    setOffset(0)
  }, [qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const permisosData = await api('/api/catalogos/permisos')
        if (!alive) return
        setCatalogoPermisos(Array.isArray(permisosData?.datos) ? permisosData.datos : [])
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
      setLoading(true)
      try {
        await loadRoles()
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
  }, [loadRoles])

  const filtrados = roles

  const stats = {
    total,
    usuariosAsignados: resumen.usuarios,
    protegidos: resumen.protegidos,
    permisos: catalogoPermisos.length,
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
      const data = await api(`/api/roles/${id}`)
      const rol = data.rol
      setForm({
        nombre: field(rol, 'Nombre') || '',
        descripcion: field(rol, 'Descripcion') || '',
      })
      setFormOpen(true)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar el rol')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const data = await api(`/api/roles/${id}`)
      setDetail(data.rol)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar el detalle')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function openDelete(r) {
    setDeleteTarget(r)
    setDeleteOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    const nombre = form.nombre.trim().toUpperCase()
    if (!nombre) {
      toast.error('El nombre del rol es obligatorio')
      return
    }

    setSaving(true)
    try {
      if (formMode === 'create') {
        await api('/api/roles', {
          method: 'POST',
          body: {
            nombre,
            descripcion: form.descripcion.trim() || null,
          },
        })
        toast.success('Rol creado exitosamente')
      } else {
        await api(`/api/roles/${editId}`, {
          method: 'PUT',
          body: {
            nombre,
            descripcion: form.descripcion.trim() || null,
          },
        })
        toast.success('Rol actualizado exitosamente')
      }
      setFormOpen(false)
      await loadRoles()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el rol')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID', 'Id')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/roles/${id}`, { method: 'DELETE' })
      toast.success('Rol eliminado exitosamente')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadRoles()
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el rol')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <RolesSkeleton />

  if (error) {
    return <p className="text-destructive">No se pudieron cargar los roles: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Usuarios · Roles
          </p>
          <h1 className="font-display text-3xl">Roles</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Catálogo del modelo. El acceso lo decide el rol. 
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/usuarios"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Ver usuarios
          </Link>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo rol
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Shield} label="Roles" value={stats.total} hint="Registros en roles" />
        <Kpi icon={Users} label="Asignaciones" value={stats.usuariosAsignados} hint="Usuarios con rol" />
        <Kpi icon={ShieldAlert} label="Protegidos" value={stats.protegidos} hint="ADMIN, CAJERO, etc." />
        <Kpi icon={Shield} label="Permisos" value={stats.permisos} hint="Catalogo de permisos" />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Catalogo de roles</CardTitle>
            <CardDescription>
              {total} registros
            </CardDescription>
          </div>
          <Buscador value={q} onChange={setQ} placeholder="Buscar rol…" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay roles que coincidan</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>Usuarios</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => {
                  const id = field(r, 'ID', 'Id')
                  const nombre = field(r, 'Nombre') || '—'
                  const descripcion = field(r, 'Descripcion')
                  const total = Number(field(r, 'Total_Usuarios', 'TOTAL_USUARIOS') || 0)
                  const protegido = isProtegido(nombre)

                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{nombre}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">
                        {descripcion || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{total}</Badge>
                      </TableCell>
                      <TableCell>
                        {protegido ? (
                          <Badge variant="warn">Sistema</Badge>
                        ) : (
                          <Badge variant="outline">Personalizado</Badge>
                        )}
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
                            title={protegido ? 'Rol protegido' : total > 0 ? 'Tiene usuarios asignados' : 'Eliminar'}
                            disabled={protegido || total > 0}
                            onClick={() => openDelete(r)}
                          >
                            <Trash2 className={`h-4 w-4 ${protegido || total > 0 ? '' : 'text-destructive'}`} />
                          </Button>
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
            <DialogTitle>{formMode === 'create' ? 'Nuevo rol' : 'Editar rol'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-3">
            <Field id="nombre" label="Nombre *">
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value.toUpperCase() }))}
                placeholder="EJ: SUPERVISOR"
                required
              />
            </Field>
            <Field id="descripcion" label="Descripcion">
              <Input
                id="descripcion"
                value={form.descripcion}
                onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Que puede hacer este rol"
              />
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
            <DialogTitle>Detalle de rol</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Nombre</span>
                <span className="font-medium">{field(detail, 'Nombre')}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Descripcion</span>
                <span className="max-w-[60%] text-right">{field(detail, 'Descripcion') || '—'}</span>
              </div>
              <div>
                <p className="mb-2 text-muted-foreground">Catálogo del modelo. El acceso lo decide el rol.</p>
                <div className="flex flex-wrap gap-1.5">
                  {(detail.permisos || []).length === 0 ? (
                    <span className="text-muted-foreground">Sin permisos asignados</span>
                  ) : (
                    (detail.permisos || []).map((p) => (
                      <Badge key={field(p, 'ID')} variant="secondary">
                        {field(p, 'Nombre')}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
            <DialogDescription>
              Solo se puede eliminar si no es un rol del sistema y no tiene usuarios asignados
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Eliminar el rol <span className="font-medium">{field(deleteTarget, 'Nombre')}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
