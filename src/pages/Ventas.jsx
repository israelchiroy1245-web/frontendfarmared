import { useCallback, useEffect, useRef, useState } from 'react'
import { Ban, Eye, Plus, Receipt, Trash2 } from 'lucide-react'
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

const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']
const TIPOS_DOC = ['TICKET', 'FACTURA']
const ESTADOS = ['EMITIDA', 'ANULADA']

function pagoVacio() {
  return { metodoPago: 'EFECTIVO', monto: '', referencia: '' }
}

function badgeEstado(estado) {
  const valor = String(estado || '').toUpperCase()
  if (valor === 'EMITIDA') return 'ok'
  if (valor === 'ANULADA') return 'danger'
  return 'secondary'
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function lineaVacia() {
  return { medicamentoId: '', cantidad: '1' }
}

function puedeCobrar() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'CAJERO'
}

export default function Ventas() {
  const cobrar = puedeCobrar()
  const [ventas, setVentas] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [medicamentos, setMedicamentos] = useState([])
  const [sucursalId, setSucursalId] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
  const [estado, setEstado] = useState('')
  const [tipoDoc, setTipoDoc] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [monto, setMonto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formSucursal, setFormSucursal] = useState('')
  const [formTipo, setFormTipo] = useState('TICKET')
  const [nit, setNit] = useState('CF')
  const [nombreFactura, setNombreFactura] = useState('Consumidor Final')
  const [lineas, setLineas] = useState([lineaVacia()])
  const [pagos, setPagos] = useState([pagoVacio()])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [anularOpen, setAnularOpen] = useState(false)
  const [anularTarget, setAnularTarget] = useState(null)

  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const [suc, med] = await Promise.all([
      api('/api/catalogos/sucursales'),
      api('/api/catalogos/medicamentos'),
    ])
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
    setMedicamentos(Array.isArray(med?.datos) ? med.datos : [])
  }, [])

  const loadVentas = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (metodoPago) query.metodoPago = metodoPago
    if (estado) query.estado = estado
    if (tipoDoc) query.tipoDoc = tipoDoc
    if (fechaDesde) query.fechaDesde = fechaDesde
    if (fechaHasta) query.fechaHasta = fechaHasta
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/ventas', { query })
    if (id !== reqId.current) return
    setVentas(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setMonto(Number(data?.resumen?.monto ?? 0))
  }, [limit, offset, sucursalId, metodoPago, estado, tipoDoc, fechaDesde, fechaHasta, qDebounced])

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
  }, [sucursalId, metodoPago, estado, tipoDoc, fechaDesde, fechaHasta, qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadVentas()
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
  }, [loadVentas])

  function abrirAlta() {
    setFormSucursal(sucursalId)
    setFormTipo('TICKET')
    setNit('CF')
    setNombreFactura('Consumidor Final')
    setLineas([lineaVacia()])
    setPagos([pagoVacio()])
    setFormOpen(true)
  }

  function setLinea(index, key, value) {
    setLineas((prev) => prev.map((linea, i) => (i === index ? { ...linea, [key]: value } : linea)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!formSucursal) {
      toast.error('La sucursal es obligatoria')
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
      items.push({ medicamentoId: Number(linea.medicamentoId), cantidad })
    }

    const pagosBody = []
    for (const pago of pagos) {
      if (String(pago.monto).trim() === '') continue
      const monto = Number(pago.monto)
      if (!Number.isFinite(monto) || monto <= 0) {
        toast.error('Cada pago con monto debe ser mayor a cero')
        return
      }
      pagosBody.push({
        metodoPago: pago.metodoPago,
        monto,
        referencia: pago.referencia.trim() || undefined,
      })
    }
    if (pagosBody.length === 0 && pagos.length > 1) {
      toast.error('En un pago mixto indica el monto de cada forma')
      return
    }

    setSaving(true)
    try {
      const data = await api('/api/ventas', {
        method: 'POST',
        body: {
          sucursalId: Number(formSucursal),
          tipoDoc: formTipo,
          nit: nit.trim() || 'CF',
          nombreFactura: nombreFactura.trim() || 'Consumidor Final',
          items,
          ...(pagosBody.length > 0
            ? { pagos: pagosBody }
            : { metodoPago: pagos[0]?.metodoPago || 'EFECTIVO' }),
        },
      })
      toast.success(data.mensaje || 'Venta emitida')
      setFormOpen(false)
      await loadVentas()
    } catch (err) {
      toast.error(err.message || 'No se pudo emitir la venta')
    } finally {
      setSaving(false)
    }
  }

  function setPago(index, key, value) {
    setPagos((prev) => prev.map((pago, i) => (i === index ? { ...pago, [key]: value } : pago)))
  }

  async function handleAnular() {
    const id = field(anularTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/ventas/${id}/anular`, { method: 'POST' })
      toast.success(data.mensaje || 'Ticket anulado')
      setAnularOpen(false)
      setAnularTarget(null)
      await loadVentas()
    } catch (err) {
      toast.error(err.message || 'No se pudo anular el ticket')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/ventas/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar la venta')
      setDetailOpen(false)
    }
  }

  if (loading && ventas.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && ventas.length === 0) {
    return <p className="text-destructive">No se pudieron cargar las ventas: {error}</p>
  }

  const itemsDetalle = detail?.ITEMS || detail?.items || []
  const pagosDetalle = detail?.PAGOS || detail?.pagos || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · Ventas</p>
          <h1 className="font-display text-3xl">Ventas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Ticket de sucursal. Hace falta un turno de caja abierto. El lote lo elige el vencimiento y el pago puede ser mixto.
          </p>
        </div>
        {cobrar ? (
          <Button className="gap-2" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Emitir venta
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Ventas</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total con el filtro actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monto cobrado</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(monto)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Suma de totales de venta</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Facturas de venta</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar folio, NIT, sucursal o cliente…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>
                  {field(s, 'Nombre')}
                </option>
              ))}
            </select>
            <select className={selectClass} aria-label="Método de pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
              <option value="">Todos los pagos</option>
              {METODOS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Tipo de documento" value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)}>
              <option value="">Ticket y factura</option>
              {TIPOS_DOC.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <Input type="date" aria-label="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <Input type="date" aria-label="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {ventas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay ventas con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((row) => {
                  const id = field(row, 'ID')
                  const est = String(field(row, 'ESTADO') || '')
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'FOLIO') || '—'}</TableCell>
                      <TableCell>{field(row, 'FECHA') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'NOMBRE_FACTURA') || field(row, 'CLIENTE_NOMBRE') || 'Consumidor Final'}</TableCell>
                      <TableCell>{field(row, 'METODOS_PAGO') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL'))}</TableCell>
                      <TableCell>
                        <Badge variant={badgeEstado(est)}>{est || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {cobrar && est === 'EMITIDA' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Anular"
                              onClick={() => {
                                setAnularTarget(row)
                                setAnularOpen(true)
                              }}
                            >
                              <Ban className="h-4 w-4" />
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir venta</DialogTitle>
            <DialogDescription>
              La sucursal necesita un turno de caja abierto. El lote lo elige el vencimiento. Si dejas el monto vacío, el cobro queda en un solo método por el total del ticket.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="formSucursal">Sucursal</Label>
                <select id="formSucursal" className={selectClass} value={formSucursal} onChange={(e) => setFormSucursal(e.target.value)}>
                  <option value="">Selecciona</option>
                  {sucursales.map((s) => (
                    <option key={field(s, 'ID')} value={field(s, 'ID')}>
                      {field(s, 'Nombre')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formTipo">Documento</Label>
                <select id="formTipo" className={selectClass} value={formTipo} onChange={(e) => setFormTipo(e.target.value)}>
                  {TIPOS_DOC.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nit">NIT</Label>
                <Input id="nit" value={nit} onChange={(e) => setNit(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nombreFactura">Nombre en factura</Label>
                <Input id="nombreFactura" value={nombreFactura} onChange={(e) => setNombreFactura(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              {lineas.map((linea, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label>Medicamento</Label>
                    <select className={selectClass} value={linea.medicamentoId} onChange={(e) => setLinea(index, 'medicamentoId', e.target.value)}>
                      <option value="">Selecciona</option>
                      {medicamentos.map((m) => (
                        <option key={field(m, 'ID')} value={field(m, 'ID')}>
                          {field(m, 'NOMBRE_MEDICAMENTO')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Cantidad</Label>
                    <div className="flex gap-1">
                      <Input type="number" min="1" value={linea.cantidad} onChange={(e) => setLinea(index, 'cantidad', e.target.value)} />
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
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>
                Agregar línea
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Pagos</p>
              {pagos.map((pago, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Método</Label>
                    <select className={selectClass} value={pago.metodoPago} onChange={(e) => setPago(index, 'metodoPago', e.target.value)}>
                      {METODOS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Monto</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Total"
                      value={pago.monto}
                      onChange={(e) => setPago(index, 'monto', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Referencia</Label>
                    <div className="flex gap-1">
                      <Input value={pago.referencia} onChange={(e) => setPago(index, 'referencia', e.target.value)} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Quitar pago"
                        disabled={pagos.length === 1}
                        onClick={() => setPagos((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setPagos((prev) => [...prev, pagoVacio()])}>
                Agregar pago
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Emitiendo…' : 'Emitir venta'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{field(detail, 'FOLIO') || 'Venta'}</DialogTitle>
            <DialogDescription>
              {field(detail, 'SUCURSAL_NOMBRE') || '—'} · {field(detail, 'FECHA') || '—'} · {field(detail, 'TIPO_DOC') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant={badgeEstado(field(detail, 'ESTADO'))}>{field(detail, 'ESTADO') || '—'}</Badge>
                <span>
                  {field(detail, 'NOMBRE_FACTURA') || 'Consumidor Final'} · NIT {field(detail, 'NIT') || 'CF'} · Cajero {field(detail, 'CAJERO_NOMBRE') || '—'}
                </span>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <p>Subtotal {gtq(field(detail, 'SUBTOTAL'))}</p>
                <p>IVA {gtq(field(detail, 'IVA'))}</p>
                <p>Descuento {gtq(field(detail, 'DESCUENTO'))}</p>
                <p>Total {gtq(field(detail, 'TOTAL'))}</p>
                <p>Recibido {gtq(field(detail, 'MONTO_RECIBIDO'))}</p>
                <p>Vuelto {gtq(field(detail, 'VUELTO'))}</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsDetalle.map((linea) => (
                    <TableRow key={field(linea, 'ID')}>
                      <TableCell>{field(linea, 'NOMBRE_MEDICAMENTO') || '—'}</TableCell>
                      <TableCell>{field(linea, 'LOTE') || '—'}</TableCell>
                      <TableCell>{field(linea, 'CANTIDAD')}</TableCell>
                      <TableCell>{gtq(field(linea, 'PRECIO'))}</TableCell>
                      <TableCell>{gtq(field(linea, 'SUBTOTAL'))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagosDetalle.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">Sin pagos registrados</TableCell>
                    </TableRow>
                  ) : pagosDetalle.map((pago) => (
                    <TableRow key={field(pago, 'ID') || `${field(pago, 'METODO_PAGO')}-${field(pago, 'MONTO')}`}>
                      <TableCell>{field(pago, 'METODO_PAGO') || '—'}</TableCell>
                      <TableCell>{gtq(field(pago, 'MONTO'))}</TableCell>
                      <TableCell>{field(pago, 'REFERENCIA') || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={anularOpen} onOpenChange={setAnularOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {field(anularTarget, 'FOLIO') || 'ticket'}</DialogTitle>
            <DialogDescription>
              Solo un ticket emitido se puede anular. El stock vuelve al lote y la caja deshace el cobro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAnularOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleAnular} disabled={saving}>
              {saving ? 'Anulando…' : 'Anular ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
