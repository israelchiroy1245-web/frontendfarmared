import { useCallback, useEffect, useState } from 'react'
import {
  Building2,
  Eye,
  Fuel,
  MapPin,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Buscador from '@/components/Buscador'
import { api, fmtDate } from '@/lib/utils'
import { getRol } from '@/lib/roles'
import { useDebounced } from '@/lib/useDebounced'
import Paginacion from '@/components/Paginacion'

const TIPOS = ['MALL', 'TRADICIONAL', 'GASOLINERA']
const ESTADOS = ['ACTIVA', 'INACTIVA']

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

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

function tipoBadge(tipo) {
  const t = String(tipo || '').toUpperCase()
  if (t === 'MALL') return 'mall'
  if (t === 'TRADICIONAL') return 'tradicional'
  if (t === 'GASOLINERA') return 'gasolinera'
  return 'secondary'
}

function isActiva(estado) {
  return String(estado || '').toUpperCase() === 'ACTIVA'
}

const emptyForm = {
  codigo: '',
  nombre: '',
  tipo: 'MALL',
  departamento: '',
  municipio: '',
  direccion: '',
  latitud: '',
  longitud: '',
  telefono: '',
  horario: '',
  fechaApertura: '',
  estado: 'ACTIVA',
}

function formFromSucursal(s) {
  return {
    codigo: field(s, 'Codigo') || '',
    nombre: field(s, 'Nombre') || '',
    tipo: String(field(s, 'Tipo') || 'MALL').toUpperCase(),
    departamento: field(s, 'Departamento') || '',
    municipio: field(s, 'Municipio') || '',
    direccion: field(s, 'Direccion') || '',
    latitud: field(s, 'Latitud') != null ? String(field(s, 'Latitud')) : '',
    longitud: field(s, 'Longitud') != null ? String(field(s, 'Longitud')) : '',
    telefono: field(s, 'Telefono') || '',
    horario: field(s, 'Horario') || '',
    fechaApertura: field(s, 'Fecha_Apertura', 'Fecha_apertura') || '',
    estado: String(field(s, 'Estado') || 'ACTIVA').toUpperCase(),
  }
}

function Field({ id, label, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function TipoKpi({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription className="uppercase tracking-wide">{label}</CardDescription>
        <div className="rounded-md bg-secondary p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-display text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function SucursalesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-full max-w-lg" />
        </div>
        <Skeleton className="h-8 w-full sm:w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

export default function Sucursales() {
  const editar = getRol() === 'ADMIN' || getRol() === 'QF'
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [conteos, setConteos] = useState({ MALL: 0, TRADICIONAL: 0, GASOLINERA: 0 })
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [actionOpen, setActionOpen] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [actionKind, setActionKind] = useState('desactivar') // desactivar | reactivar

  const loadSucursales = useCallback(async () => {
    const query = { limit, offset }
    if (filtroTipo) query.tipo = filtroTipo
    if (filtroEstado) query.estado = filtroEstado
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/sucursales', { query })
    setSucursales(Array.isArray(data?.sucursales) ? data.sucursales : [])
    setTotal(Number(data?.paginacion?.total ?? 0))
    setConteos({
      MALL: Number(data?.conteos?.MALL ?? 0),
      TRADICIONAL: Number(data?.conteos?.TRADICIONAL ?? 0),
      GASOLINERA: Number(data?.conteos?.GASOLINERA ?? 0),
    })
  }, [filtroTipo, filtroEstado, qDebounced, limit, offset])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadSucursales()
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
  }, [loadSucursales])

  const filtradas = sucursales

  useEffect(() => {
    setOffset(0)
  }, [qDebounced, filtroTipo, filtroEstado, limit])

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
      const data = await api(`/api/sucursales/${id}`)
      setForm(formFromSucursal(data.sucursal))
      setFormOpen(true)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar la sucursal')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const data = await api(`/api/sucursales/${id}`)
      setDetail(data.sucursal)
    } catch (e) {
      toast.error(e.message || 'No se pudo cargar el detalle')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function openAction(s, kind) {
    setActionTarget(s)
    setActionKind(kind)
    setActionOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nombre.trim() || !form.tipo || !form.departamento.trim() || !form.municipio.trim()) {
      toast.error('codigo, nombre, tipo, departamento y municipio son obligatorios')
      return
    }

    setSaving(true)
    try {
      if (formMode === 'create') {
        const body = {
          codigo: form.codigo.trim().toUpperCase(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          departamento: form.departamento.trim(),
          municipio: form.municipio.trim(),
          direccion: form.direccion.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          horario: form.horario.trim() || undefined,
          fechaApertura: form.fechaApertura || undefined,
        }
        if (form.latitud !== '') body.latitud = Number(form.latitud)
        if (form.longitud !== '') body.longitud = Number(form.longitud)

        await api('/api/sucursales', { method: 'POST', body })
        toast.success('Sucursal creada exitosamente')
      } else {
        const body = {
          codigo: form.codigo.trim().toUpperCase(),
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          departamento: form.departamento.trim(),
          municipio: form.municipio.trim(),
          direccion: form.direccion,
          telefono: form.telefono,
          horario: form.horario,
          estado: form.estado,
        }
        body.latitud = form.latitud === '' ? null : Number(form.latitud)
        body.longitud = form.longitud === '' ? null : Number(form.longitud)

        await api(`/api/sucursales/${editId}`, { method: 'PUT', body })
        toast.success('Sucursal actualizada exitosamente')
      }
      setFormOpen(false)
      await loadSucursales()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleAction() {
    const id = field(actionTarget, 'ID', 'Id')
    if (!id) return
    setSaving(true)
    try {
      if (actionKind === 'desactivar') {
        await api(`/api/sucursales/${id}`, { method: 'DELETE' })
        toast.success('Sucursal desactivada exitosamente')
      } else {
        await api(`/api/sucursales/${id}/reactivar`, { method: 'PATCH' })
        toast.success('Sucursal reactivada exitosamente')
      }
      setActionOpen(false)
      setActionTarget(null)
      await loadSucursales()
    } catch (err) {
      toast.error(err.message || 'No se pudo completar la acción')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SucursalesSkeleton />

  if (error) {
    return <p className="text-destructive">No se pudieron cargar las sucursales: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-3xl">Sucursales</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Malls, farmacias tradicionales y stands en gasolinera en el interior del pais
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            className={`${selectClass} sm:w-40`}
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className={`${selectClass} sm:w-40`}
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Buscador value={q} onChange={setQ} placeholder="Buscar sucursal o departamento" />
          {editar ? (
            <Button onClick={openCreate} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Nueva
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TipoKpi icon={Building2} label="Mall" value={conteos.MALL} />
        <TipoKpi icon={Store} label="Tradicional" value={conteos.TRADICIONAL} />
        <TipoKpi icon={Fuel} label="Gasolinera" value={conteos.GASOLINERA} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Red de sucursales</CardTitle>
          <CardDescription>
            {total} puntos de venta
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtradas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay sucursales que coincidan con la búsqueda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead className="text-right">Personal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((s) => {
                  const id = field(s, 'ID', 'Id')
                  const nombre = field(s, 'Nombre') || '—'
                  const codigo = field(s, 'Codigo')
                  const horario = field(s, 'Horario')
                  const tipo = String(field(s, 'Tipo') || '—').toUpperCase()
                  const municipio = field(s, 'Municipio')
                  const depto = field(s, 'Departamento')
                  const ubicacion = [municipio, depto].filter(Boolean).join(', ') || '—'
                  const direccion = field(s, 'Direccion')
                  const personal = field(s, 'Total_Empleados', 'TOTAL_EMPLEADOS')
                  const estado = field(s, 'Estado')
                  const activa = isActiva(estado)

                  return (
                    <TableRow key={id ?? `${codigo}-${nombre}`}>
                      <TableCell>
                        <p className="font-medium">{nombre}</p>
                        <p className="text-xs text-muted-foreground">
                          {[codigo, horario].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tipoBadge(tipo)}>{tipo}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{ubicacion}</p>
                            <p className="text-xs text-muted-foreground">{direccion || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{personal ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant={activa ? 'ok' : 'danger'}>{estado || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Ver" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {editar ? (
                            <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={() => openEdit(id)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {editar && activa ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Desactivar"
                              onClick={() => openAction(s, 'desactivar')}
                            >
                              <PowerOff className="h-4 w-4 text-destructive" />
                            </Button>
                          ) : null}
                          {editar && !activa ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Reactivar"
                              onClick={() => openAction(s, 'reactivar')}
                            >
                              <Power className="h-4 w-4 text-emerald-700" />
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

      {/* Crearsucursales  / Editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}</DialogTitle>
            <DialogDescription>
              Campos obligatorios: código, nombre, tipo, departamento y municipio
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="codigo" label="Código *">
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setFormField('codigo', e.target.value.toUpperCase())}
                  placeholder="GT-CAY"
                  required
                />
              </Field>
              <Field id="tipo" label="Tipo *">
                <select
                  id="tipo"
                  className={selectClass}
                  value={form.tipo}
                  onChange={(e) => setFormField('tipo', e.target.value)}
                  required
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field id="nombre" label="Nombre *">
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setFormField('nombre', e.target.value)}
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="departamento" label="Departamento *">
                <Input
                  id="departamento"
                  value={form.departamento}
                  onChange={(e) => setFormField('departamento', e.target.value)}
                  required
                />
              </Field>
              <Field id="municipio" label="Municipio *">
                <Input
                  id="municipio"
                  value={form.municipio}
                  onChange={(e) => setFormField('municipio', e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field id="direccion" label="Dirección">
              <Input
                id="direccion"
                value={form.direccion}
                onChange={(e) => setFormField('direccion', e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="telefono" label="Teléfono">
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setFormField('telefono', e.target.value)}
                />
              </Field>
              <Field id="horario" label="Horario">
                <Input
                  id="horario"
                  value={form.horario}
                  onChange={(e) => setFormField('horario', e.target.value)}
                  placeholder="08:00—22:00"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="latitud" label="Latitud">
                <Input
                  id="latitud"
                  type="number"
                  step="any"
                  value={form.latitud}
                  onChange={(e) => setFormField('latitud', e.target.value)}
                />
              </Field>
              <Field id="longitud" label="Longitud">
                <Input
                  id="longitud"
                  type="number"
                  step="any"
                  value={form.longitud}
                  onChange={(e) => setFormField('longitud', e.target.value)}
                />
              </Field>
            </div>
            {formMode === 'create' ? (
              <Field id="fechaApertura" label="Fecha de apertura">
                <Input
                  id="fechaApertura"
                  type="date"
                  value={form.fechaApertura}
                  onChange={(e) => setFormField('fechaApertura', e.target.value)}
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
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </Field>
            )}
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
            <DialogTitle>Detalle de sucursal</DialogTitle>
            <DialogDescription>GET /api/sucursales/:id</DialogDescription>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : (
            <dl className="grid gap-2 text-sm">
              {[
                ['Código', field(detail, 'Codigo')],
                ['Nombre', field(detail, 'Nombre')],
                ['Tipo', field(detail, 'Tipo')],
                ['Departamento', field(detail, 'Departamento')],
                ['Municipio', field(detail, 'Municipio')],
                ['Dirección', field(detail, 'Direccion')],
                ['Teléfono', field(detail, 'Telefono')],
                ['Horario', field(detail, 'Horario')],
                ['Latitud', field(detail, 'Latitud')],
                ['Longitud', field(detail, 'Longitud')],
                ['Apertura', field(detail, 'Fecha_Apertura', 'Fecha_apertura')],
                ['Empleados', field(detail, 'Total_Empleados', 'TOTAL_EMPLEADOS')],
                ['Estado', field(detail, 'Estado')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">
                    {label === 'Estado' ? (
                      <Badge variant={isActiva(value) ? 'ok' : 'danger'}>{value || '—'}</Badge>
                    ) : label === 'Apertura' ? (
                      fmtDate(value)?.slice?.(0, 10) || value || '—'
                    ) : (
                      value ?? '—'
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Desactivar / Reactivar */}
      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionKind === 'desactivar' ? 'Desactivar sucursal' : 'Reactivar sucursal'}
            </DialogTitle>
            <DialogDescription>
              {actionKind === 'desactivar'
                ? 'Baja lógica: Estado = INACTIVA. No se elimina el historial.'
                : 'La sucursal volverá a Estado = ACTIVA.'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿{actionKind === 'desactivar' ? 'Desactivar' : 'Reactivar'}{' '}
            <span className="font-medium">{field(actionTarget, 'Nombre')}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActionOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={actionKind === 'desactivar' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={saving}
            >
              {saving ? 'Procesando…' : actionKind === 'desactivar' ? 'Desactivar' : 'Reactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
