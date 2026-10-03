import { useCallback, useEffect, useRef, useState } from 'react'
import { Landmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Buscador from '@/components/Buscador'
import Paginacion from '@/components/Paginacion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, gtq } from '@/lib/utils'
import { getRol } from '@/lib/roles'
import { useDebounced } from '@/lib/useDebounced'

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

const CATEGORIAS = ['MOBILIARIO', 'EQUIPO', 'VEHICULO', 'INMUEBLE', 'TECNOLOGIA']
const ESTADOS = ['EN_USO', 'BAJA', 'MANTENIMIENTO']

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function puedeVer() {
  return ['ADMIN', 'CAJERO', 'AUDITOR', 'QF'].includes(getRol())
}

function puedeEditar() {
  return getRol() === 'ADMIN'
}

function badgeEstado(estado) {
  const valor = String(estado || '').toUpperCase()
  if (valor === 'EN_USO') return 'ok'
  if (valor === 'MANTENIMIENTO') return 'warn'
  if (valor === 'BAJA') return 'danger'
  return 'secondary'
}

const vacio = {
  codigo: '',
  nombre: '',
  categoria: 'EQUIPO',
  valorAdquisicion: '',
  fechaAdquisicion: '',
  vidaUtilMeses: '60',
  valorResidual: '0',
  estado: 'EN_USO',
  sucursalId: '',
}

export default function Activos() {
  const ver = puedeVer()
  const editar = puedeEditar()
  const [rows, setRows] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [sucursalId, setSucursalId] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(vacio)
  const [borrar, setBorrar] = useState(null)
  const [depreciarOpen, setDepreciarOpen] = useState(false)
  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const suc = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
  }, [])

  const loadActivos = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (categoria) query.categoria = categoria
    if (estado) query.estado = estado
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/activos', { query })
    if (id !== reqId.current) return
    setRows(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setBalance(data?.balance || null)
  }, [limit, offset, sucursalId, categoria, estado, qDebounced])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await loadCatalogos()
        if (alive) setError(null)
      } catch (e) {
        if (alive) setError(e.message)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadCatalogos])

  useEffect(() => {
    setOffset(0)
  }, [sucursalId, categoria, estado, qDebounced, limit])

  useEffect(() => {
    if (!ver) {
      setLoading(false)
      return undefined
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadActivos()
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
  }, [loadActivos, ver])

  function setCampo(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function abrirAlta() {
    setEditId(null)
    setForm({ ...vacio, sucursalId })
    setFormOpen(true)
  }

  function abrirEdicion(row) {
    setEditId(field(row, 'ID'))
    setForm({
      codigo: field(row, 'CODIGO') || '',
      nombre: field(row, 'NOMBRE') || '',
      categoria: field(row, 'CATEGORIA') || 'EQUIPO',
      valorAdquisicion: String(field(row, 'VALOR_ADQUISICION') ?? ''),
      fechaAdquisicion: String(field(row, 'FECHA_ADQUISICION') || '').slice(0, 10),
      vidaUtilMeses: String(field(row, 'VIDA_UTIL_MESES') ?? ''),
      valorResidual: String(field(row, 'VALOR_RESIDUAL') ?? '0'),
      estado: field(row, 'ESTADO') || 'EN_USO',
      sucursalId: String(field(row, 'SUCURSAL_ID') ?? ''),
    })
    setFormOpen(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nombre.trim() || !form.sucursalId) {
      toast.error('Código, nombre y sucursal son obligatorios')
      return
    }
    const valor = Number(form.valorAdquisicion)
    const vida = Number(form.vidaUtilMeses)
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('El valor de adquisición debe ser mayor a cero')
      return
    }
    if (!Number.isFinite(vida) || vida <= 0) {
      toast.error('La vida útil en meses debe ser mayor a cero')
      return
    }
    const body = {
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      valorAdquisicion: valor,
      fechaAdquisicion: form.fechaAdquisicion || undefined,
      vidaUtilMeses: vida,
      valorResidual: Number(form.valorResidual) || 0,
      estado: form.estado,
      sucursalId: Number(form.sucursalId),
    }
    setSaving(true)
    try {
      const data = editId
        ? await api(`/api/activos/${editId}`, { method: 'PATCH', body })
        : await api('/api/activos', { method: 'POST', body: { ...body, codigo: form.codigo.trim() } })
      toast.success(data.mensaje || (editId ? 'Activo actualizado' : 'Activo registrado'))
      setFormOpen(false)
      await loadActivos()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el activo')
    } finally {
      setSaving(false)
    }
  }

  async function handleBorrar() {
    const id = field(borrar, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/activos/${id}`, { method: 'DELETE' })
      toast.success(data.mensaje || 'Activo eliminado')
      setBorrar(null)
      await loadActivos()
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el activo')
    } finally {
      setSaving(false)
    }
  }

  async function handleDepreciar() {
    setSaving(true)
    try {
      const data = await api('/api/activos/depreciar', {
        method: 'POST',
        body: sucursalId ? { sucursalId: Number(sucursalId) } : {},
      })
      toast.success(data.mensaje || 'Depreciación lineal aplicada')
      setDepreciarOpen(false)
      await loadActivos()
    } catch (err) {
      toast.error(err.message || 'No se pudo depreciar')
    } finally {
      setSaving(false)
    }
  }

  if (!ver) {
    return <p className="text-destructive">Tu rol no puede consultar activos fijos.</p>
  }

  if (loading && rows.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && rows.length === 0) {
    return <p className="text-destructive">No se pudieron cargar los activos: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Patrimonio · Activos</p>
          <h1 className="font-display text-3xl">Activos fijos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Valor en libros es adquisición menos depreciación acumulada. La depreciación lineal corre por mes, de la sucursal filtrada o de toda la red.
          </p>
        </div>
        {editar ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setDepreciarOpen(true)}>Depreciar</Button>
            <Button className="gap-2" onClick={abrirAlta}>
              <Plus className="h-4 w-4" />
              Registrar activo
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Adquisición</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <Landmark className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(balance?.totalAdquisicion)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{total} activos con el filtro</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Depreciación acumulada</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(balance?.totalDepreciacion)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Valor en libros</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(balance?.totalLibros)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Inventario patrimonial</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar código, nombre o sucursal…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay activos con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Adquisición</TableHead>
                  <TableHead>Libros</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = field(row, 'ID')
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'CODIGO') || '—'}</TableCell>
                      <TableCell>{field(row, 'NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'CATEGORIA') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'VALOR_ADQUISICION'))}</TableCell>
                      <TableCell>{gtq(field(row, 'VALOR_LIBROS'))}</TableCell>
                      <TableCell>
                        <Badge variant={badgeEstado(field(row, 'ESTADO'))}>{field(row, 'ESTADO') || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        {editar ? (
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEdicion(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" title="Eliminar" onClick={() => setBorrar(row)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar activo' : 'Registrar activo'}</DialogTitle>
            <DialogDescription>El valor en libros lo calcula el servidor.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="codigo">Código</Label>
                <Input id="codigo" value={form.codigo} disabled={Boolean(editId)} onChange={(e) => setCampo('codigo', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoría</Label>
                <select id="categoria" className={selectClass} value={form.categoria} onChange={(e) => setCampo('categoria', e.target.value)}>
                  {CATEGORIAS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estadoActivo">Estado</Label>
                <select id="estadoActivo" className={selectClass} value={form.estado} onChange={(e) => setCampo('estado', e.target.value)}>
                  {ESTADOS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sucursalActivo">Sucursal</Label>
                <select id="sucursalActivo" className={selectClass} value={form.sucursalId} onChange={(e) => setCampo('sucursalId', e.target.value)}>
                  <option value="">Selecciona</option>
                  {sucursales.map((s) => (
                    <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valor">Valor de adquisición</Label>
                <Input id="valor" type="number" min="0" step="0.01" value={form.valorAdquisicion} onChange={(e) => setCampo('valorAdquisicion', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="residual">Valor residual</Label>
                <Input id="residual" type="number" min="0" step="0.01" value={form.valorResidual} onChange={(e) => setCampo('valorResidual', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vida">Vida útil (meses)</Label>
                <Input id="vida" type="number" min="1" value={form.vidaUtilMeses} onChange={(e) => setCampo('vidaUtilMeses', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha de adquisición</Label>
                <Input id="fecha" type="date" value={form.fechaAdquisicion} onChange={(e) => setCampo('fechaAdquisicion', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(borrar)} onOpenChange={(open) => { if (!open) setBorrar(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar {field(borrar, 'CODIGO') || 'activo'}</DialogTitle>
            <DialogDescription>Esta acción quita el activo del inventario patrimonial.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBorrar(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleBorrar} disabled={saving}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={depreciarOpen} onOpenChange={setDepreciarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depreciación lineal</DialogTitle>
            <DialogDescription>
              {sucursalId
                ? 'Se recalcula la depreciación de los activos en uso de la sucursal filtrada.'
                : 'Se recalcula la depreciación de los activos en uso de toda la red.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDepreciarOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={handleDepreciar} disabled={saving}>{saving ? 'Calculando…' : 'Aplicar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
