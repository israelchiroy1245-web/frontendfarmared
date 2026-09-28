import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Plus, Shield, Trash2 } from 'lucide-react'
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

function PermisosSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export default function Permisos() {
  const [permisos, setPermisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [enUso, setEnUso] = useState(0)
  const [saving, setSaving] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [nombre, setNombre] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadPermisos = useCallback(async () => {
    const query = { limit, offset }
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/permisos', { query })
    setPermisos(Array.isArray(data?.permisos) ? data.permisos : [])
    setTotal(Number(data?.paginacion?.total ?? 0))
    setEnUso(Number(data?.resumen?.enUso ?? 0))
  }, [limit, offset, qDebounced])

  useEffect(() => {
    setOffset(0)
  }, [qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadPermisos()
        if (!alive) return
        setError(null)
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadPermisos])

  const filtrados = permisos

  const stats = { total, enUso, libres: Math.max(0, total - enUso) }

  function openCreate() {
    setNombre('')
    setCreateOpen(true)
  }

  function openDelete(p) {
    setDeleteTarget(p)
    setDeleteOpen(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    const value = nombre.trim().toUpperCase()
    if (!value) {
      toast.error('El nombre del permiso es obligatorio')
      return
    }
    setSaving(true)
    try {
      await api('/api/permisos', { method: 'POST', body: { nombre: value } })
      toast.success('Permiso creado exitosamente')
      setCreateOpen(false)
      await loadPermisos()
    } catch (err) {
      toast.error(err.message || 'No se pudo crear el permiso')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID', 'Id')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/permisos/${id}`, { method: 'DELETE' })
      toast.success('Permiso eliminado exitosamente')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadPermisos()
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el permiso')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PermisosSkeleton />

  if (error) {
    return <p className="text-destructive">No se pudieron cargar los permisos: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Usuarios · Permisos</p>
          <h1 className="font-display text-3xl">Permisos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Catálogo F_Permisos. Se asignan a roles desde el módulo Roles (F_rol_permiso).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/usuarios/roles"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Ir a roles
          </Link>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo permiso
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={KeyRound} label="Permisos" value={stats.total} hint="Total en F_Permisos" />
        <Kpi icon={Shield} label="En uso" value={stats.enUso} hint="Asignados al menos a un rol" />
        <Kpi icon={KeyRound} label="Sin asignar" value={stats.libres} hint="Se pueden eliminar" />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Catálogo de permisos</CardTitle>
            <CardDescription>
              {total} registros
            </CardDescription>
          </div>
          <Buscador value={q} onChange={setQ} placeholder="Buscar permiso…" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay permisos que coincidan.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Roles que lo usan</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const id = field(p, 'ID', 'Id')
                  const nombrePermiso = field(p, 'Nombre') || '—'
                  const totalRoles = Number(field(p, 'Total_Roles', 'TOTAL_ROLES') || 0)
                  const enUso = totalRoles > 0

                  return (
                    <TableRow key={id}>
                      <TableCell className="text-muted-foreground">{id}</TableCell>
                      <TableCell className="font-medium">{nombrePermiso}</TableCell>
                      <TableCell>
                        <Badge variant={enUso ? 'secondary' : 'outline'}>{totalRoles}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={enUso ? 'Asignado a roles; no se puede eliminar' : 'Eliminar'}
                            disabled={enUso}
                            onClick={() => openDelete(p)}
                          >
                            <Trash2 className={`h-4 w-4 ${enUso ? '' : 'text-destructive'}`} />
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo permiso</DialogTitle>
            <DialogDescription>El nombre se guarda en mayúsculas en F_Permisos.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nombrePermiso">Nombre *</Label>
              <Input
                id="nombrePermiso"
                value={nombre}
                onChange={(e) => setNombre(e.target.value.toUpperCase())}
                placeholder="EJ: VER_INVENTARIO"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creando…' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar permiso</DialogTitle>
            <DialogDescription>
              Solo se elimina si ningún rol lo tiene asignado en F_rol_permiso.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Eliminar <span className="font-medium">{field(deleteTarget, 'Nombre')}</span>?
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
