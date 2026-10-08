import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRightLeft, Eye, Plus, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Paginacion from '@/components/Paginacion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Buscador from '@/components/Buscador'
import { api } from '@/lib/utils'
import { getRol, sucursalAsignada, sucursalFijada } from '@/lib/roles'
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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const ESTADOS = ['SOLICITADA', 'EN_TRANSITO', 'RECIBIDA', 'CANCELADA']

function lineaVacia() {
  return { medicamentoId: '', cantidad: '1' }
}

function puedeGestionar() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'QF' || rol === 'ENCARGADO'
}

function puedeRecibir() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'QF' || rol === 'ENCARGADO'
}

function origenFijo() {
  const rol = getRol()
  return rol === 'ENCARGADO' || rol === 'QF'
}

function badgeEstado(estado) {
  const value = String(estado || '').toUpperCase()
  if (value === 'SOLICITADA') return 'warn'
  if (value === 'EN_TRANSITO') return 'gold'
  if (value === 'RECIBIDA') return 'ok'
  if (value === 'CANCELADA') return 'danger'
  return 'secondary'
}

function etiquetaEstado(estado) {
  const value = String(estado || '').toUpperCase()
  if (value === 'EN_TRANSITO') return 'En tránsito'
  if (value === 'SOLICITADA') return 'Solicitada'
  if (value === 'RECIBIDA') return 'Recibida'
  if (value === 'CANCELADA') return 'Cancelada'
  return estado || '—'
}

export default function Transferencias() {
  const gestionar = puedeGestionar()
  const recibir = puedeRecibir()
  const local = sucursalFijada()
  const fijaOrigen = origenFijo()
  const [rows, setRows] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [medicamentos, setMedicamentos] = useState([])
  const [sucursalId, setSucursalId] = useState(() => (sucursalFijada() ? sucursalAsignada() : ''))
  const [estado, setEstado] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [observacion, setObservacion] = useState('')
  const [lineas, setLineas] = useState([lineaVacia()])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const [suc, med] = await Promise.all([
      api('/api/catalogos/sucursales'),
      api('/api/catalogos/medicamentos'),
    ])
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
    setMedicamentos(Array.isArray(med?.datos) ? med.datos : [])
  }, [])

  const loadTransferencias = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (estado) query.estado = estado
    if (fechaDesde) query.fechaDesde = fechaDesde
    if (fechaHasta) query.fechaHasta = fechaHasta
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/transferencias', { query })
    if (id !== reqId.current) return
    const list = Array.isArray(data?.datos) ? data.datos : []
    setRows(list)
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
  }, [limit, offset, sucursalId, estado, fechaDesde, fechaHasta, qDebounced])

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
  }, [sucursalId, estado, fechaDesde, fechaHasta, qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadTransferencias()
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
  }, [loadTransferencias])

  function abrirAlta() {
    setOrigenId(fijaOrigen ? sucursalAsignada() : sucursalId)
    setDestinoId('')
    setObservacion('')
    setLineas([lineaVacia()])
    setFormOpen(true)
  }

  function setLinea(index, key, value) {
    setLineas((prev) => prev.map((linea, i) => (i === index ? { ...linea, [key]: value } : linea)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!origenId || !destinoId) {
      toast.error('Origen y destino son obligatorios')
      return
    }
    if (String(origenId) === String(destinoId)) {
      toast.error('Origen y destino no pueden ser la misma sucursal')
      return
    }
    const items = []
    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad)
      if (!linea.medicamentoId) {
        toast.error('Cada línea necesita un medicamento')
        return
      }
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        toast.error('La cantidad debe ser mayor a cero')
        return
      }
      items.push({
        medicamentoId: Number(linea.medicamentoId),
        cantidad,
      })
    }

    setSaving(true)
    try {
      await api('/api/transferencias', {
        method: 'POST',
        body: {
          origenId: Number(origenId),
          destinoId: Number(destinoId),
          observacion: observacion.trim() || undefined,
          lineas: items,
        },
      })
      toast.success('Solicitud creada. El stock aún no se descuenta')
      setFormOpen(false)
      await loadTransferencias()
    } catch (err) {
      toast.error(err.message || 'No se pudo crear la transferencia')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/transferencias/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el detalle')
      setDetailOpen(false)
    }
  }

  async function refreshDetail(id) {
    const data = await api(`/api/transferencias/${id}`)
    setDetail(data.datos)
    await loadTransferencias()
  }

  async function handleAccion(accion) {
    const id = field(detail, 'ID')
    if (!id) return
    setActing(true)
    try {
      await api(`/api/transferencias/${id}/${accion}`, { method: 'PATCH' })
      if (accion === 'enviar') toast.success('Enviada. Stock descontado en origen (FEFO)')
      else if (accion === 'recibir') toast.success('Recibida. Stock ingresado en destino')
      else toast.success('Transferencia cancelada')
      await refreshDetail(id)
    } catch (err) {
      toast.error(err.message || `No se pudo ${accion}`)
    } finally {
      setActing(false)
    }
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
    return <p className="text-destructive">No se pudieron cargar las transferencias: {error}</p>
  }

  const lineasDetalle = detail?.LINEAS || detail?.lineas || []
  const estadoDetalle = String(field(detail, 'ESTADO') || '').toUpperCase()
  const kpiSolicitadas = rows.filter((r) => String(field(r, 'ESTADO')).toUpperCase() === 'SOLICITADA').length
  const kpiTransito = rows.filter((r) => String(field(r, 'ESTADO')).toUpperCase() === 'EN_TRANSITO').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · Transferencias</p>
          <h1 className="font-display text-3xl">Transferencias entre sucursales</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Solicitud → envío (descuenta origen por FEFO) → recepción (ingresa destino). Cancelación solo en estado
            solicitada.
          </p>
        </div>
        {gestionar ? (
          <Button className="gap-2" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Nueva solicitud
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>En esta página</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{rows.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Con el filtro actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solicitadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{kpiSolicitadas}</p>
            <p className="mt-1 text-xs text-muted-foreground">Pendientes de envío</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>En tránsito</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <Truck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{kpiTransito}</p>
            <p className="mt-1 text-xs text-muted-foreground">Esperando recepción</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Listado de transferencias</CardTitle>
              <CardDescription>Sucursal de origen o destino, estado y fechas</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar sucursal u observación…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className={selectClass}
              aria-label="Sucursal"
              value={sucursalId}
              disabled={local}
              onChange={(e) => setSucursalId(e.target.value)}
            >
              {local ? null : <option value="">Todas las sucursales</option>}
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>
                  {field(s, 'Nombre')}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              aria-label="Estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {etiquetaEstado(e)}
                </option>
              ))}
            </select>
            <Input type="date" aria-label="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <Input type="date" aria-label="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay transferencias con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Solicitud</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>Solicitó</TableHead>
                  <TableHead>Líneas</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = field(row, 'ID')
                  const est = field(row, 'ESTADO')
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">#{id}</TableCell>
                      <TableCell>{field(row, 'FECHA_SOLICITUD') || '—'}</TableCell>
                      <TableCell>
                        <span className="font-medium">{field(row, 'SUCURSAL_ORIGEN_NOMBRE') || '—'}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span>{field(row, 'SUCURSAL_DESTINO_NOMBRE') || '—'}</span>
                      </TableCell>
                      <TableCell>{field(row, 'SOLICITADO_POR_NOMBRE') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{field(row, 'TOTAL_LINEAS') ?? 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeEstado(est)}>{etiquetaEstado(est)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Detalle"
                            onClick={() => openDetail(id)}
                          >
                            <Eye className="h-4 w-4" />
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de transferencia</DialogTitle>
            <DialogDescription>
              Queda en estado SOLICITADA. El inventario se mueve al enviar (origen) y al recibir (destino).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="origenId">Sucursal origen</Label>
                <select
                  id="origenId"
                  className={selectClass}
                  value={origenId}
                  disabled={fijaOrigen}
                  onChange={(e) => setOrigenId(e.target.value)}
                >
                  {fijaOrigen ? null : <option value="">Selecciona</option>}
                  {sucursales.map((s) => (
                    <option key={field(s, 'ID')} value={field(s, 'ID')}>
                      {field(s, 'Nombre')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destinoId">Sucursal destino</Label>
                <select
                  id="destinoId"
                  className={selectClass}
                  value={destinoId}
                  onChange={(e) => setDestinoId(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {sucursales
                    .filter((s) => !fijaOrigen || String(field(s, 'ID')) !== sucursalAsignada())
                    .map((s) => (
                    <option key={field(s, 'ID')} value={field(s, 'ID')}>
                      {field(s, 'Nombre')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="observacion">Observación</Label>
              <Input
                id="observacion"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="space-y-3">
              {lineas.map((linea, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Medicamento</Label>
                    <select
                      className={selectClass}
                      value={linea.medicamentoId}
                      onChange={(e) => setLinea(index, 'medicamentoId', e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {medicamentos.map((m) => (
                        <option key={field(m, 'ID')} value={field(m, 'ID')}>
                          {field(m, 'NOMBRE_MEDICAMENTO')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={linea.cantidad}
                      onChange={(e) => setLinea(index, 'cantidad', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Quitar línea"
                      disabled={lineas.length === 1}
                      onClick={() => setLineas((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>
                Agregar línea
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creando…' : 'Crear solicitud'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transferencia #{field(detail, 'ID') || '…'}</DialogTitle>
            <DialogDescription>
              {field(detail, 'SUCURSAL_ORIGEN_NOMBRE') || '—'} → {field(detail, 'SUCURSAL_DESTINO_NOMBRE') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={badgeEstado(estadoDetalle)}>{etiquetaEstado(estadoDetalle)}</Badge>
                <span className="text-sm text-muted-foreground">
                  Solicitó {field(detail, 'SOLICITADO_POR_NOMBRE') || '—'} · {field(detail, 'FECHA_SOLICITUD') || '—'}
                </span>
              </div>
              {field(detail, 'OBSERVACION') ? (
                <p className="text-sm text-muted-foreground">{field(detail, 'OBSERVACION')}</p>
              ) : null}
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Envío: </span>
                  {field(detail, 'FECHA_ENVIO') || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Recepción: </span>
                  {field(detail, 'FECHA_RECEPCION') || '—'}
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Cant.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineasDetalle.map((linea) => (
                    <TableRow key={field(linea, 'ID')}>
                      <TableCell>{field(linea, 'NOMBRE_MEDICAMENTO') || '—'}</TableCell>
                      <TableCell>{field(linea, 'CODIGO_BARRA') || '—'}</TableCell>
                      <TableCell>{field(linea, 'CANTIDAD')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {(() => {
                const origenDetalle = String(field(detail, 'SUCURSAL_ORIGEN_ID') || '')
                const destinoDetalle = String(field(detail, 'SUCURSAL_DESTINO_ID') || '')
                const mia = sucursalAsignada()
                const esAdmin = getRol() === 'ADMIN'
                const puedeEnviarEsta = gestionar && (esAdmin || origenDetalle === mia)
                const puedeRecibirEsta = recibir && (esAdmin || destinoDetalle === mia)
                if (!(puedeEnviarEsta && estadoDetalle === 'SOLICITADA') && !(puedeRecibirEsta && estadoDetalle === 'EN_TRANSITO')) {
                  return null
                }
                return (
                <DialogFooter className="gap-2 sm:justify-start">
                  {puedeEnviarEsta && estadoDetalle === 'SOLICITADA' ? (
                    <>
                      <Button disabled={acting} onClick={() => handleAccion('enviar')}>
                        {acting ? 'Procesando…' : 'Enviar (descontar origen)'}
                      </Button>
                      <Button variant="outline" disabled={acting} onClick={() => handleAccion('cancelar')}>
                        Cancelar solicitud
                      </Button>
                    </>
                  ) : null}
                  {puedeRecibirEsta && estadoDetalle === 'EN_TRANSITO' ? (
                    <Button disabled={acting} onClick={() => handleAccion('recibir')}>
                      {acting ? 'Procesando…' : 'Recibir en destino'}
                    </Button>
                  ) : null}
                </DialogFooter>
                )
              })()}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
