import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Plus, Receipt, Trash2 } from 'lucide-react'
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
import { getUser } from '@/lib/auth'
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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function lineaVacia() {
  return { medicamentoId: '', cantidad: '1' }
}

function puedeCobrar() {
  const rol = String(getUser()?.rol || '').toUpperCase()
  return rol === 'ADMIN' || rol === 'CAJERO'
}

export default function Ventas() {
  const cobrar = puedeCobrar()
  const [ventas, setVentas] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [medicamentos, setMedicamentos] = useState([])
  const [sucursalId, setSucursalId] = useState('')
  const [metodoPago, setMetodoPago] = useState('')
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
  const [formPago, setFormPago] = useState('EFECTIVO')
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

  const loadVentas = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (metodoPago) query.metodoPago = metodoPago
    if (fechaDesde) query.fechaDesde = fechaDesde
    if (fechaHasta) query.fechaHasta = fechaHasta
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/ventas', { query })
    if (id !== reqId.current) return
    setVentas(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setMonto(Number(data?.resumen?.monto ?? 0))
  }, [limit, offset, sucursalId, metodoPago, fechaDesde, fechaHasta, qDebounced])

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
  }, [sucursalId, metodoPago, fechaDesde, fechaHasta, qDebounced, limit])

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
    setFormPago('EFECTIVO')
    setLineas([lineaVacia()])
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

    setSaving(true)
    try {
      const data = await api('/api/ventas', {
        method: 'POST',
        body: {
          sucursalId: Number(formSucursal),
          metodoPago: formPago,
          items,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · Ventas</p>
          <h1 className="font-display text-3xl">Ventas</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cobro en sucursal. El lote lo elige la fecha de vencimiento: el stock sale por procesar_venta.
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
            <Buscador value={q} onChange={setQ} placeholder="Buscar sucursal, cajero o cliente…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((row) => {
                  const id = field(row, 'ID')
                  return (
                    <TableRow key={id}>
                      <TableCell>{field(row, 'FECHA') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'CLIENTE_NOMBRE') || 'Consumidor Final'}</TableCell>
                      <TableCell>{field(row, 'METODO_PAGO') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL'))}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{field(row, 'ESTADO') || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir venta</DialogTitle>
            <DialogDescription>
              Queda a nombre de consumidor final. Cada línea descuenta el lote que vence primero en esa sucursal.
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
                <Label htmlFor="formPago">Método de pago</Label>
                <select id="formPago" className={selectClass} value={formPago} onChange={(e) => setFormPago(e.target.value)}>
                  {METODOS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
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
            <DialogTitle>Venta {field(detail, 'ID') ? `#${field(detail, 'ID')}` : ''}</DialogTitle>
            <DialogDescription>
              {field(detail, 'SUCURSAL_NOMBRE') || '—'} · {field(detail, 'FECHA') || '—'} · {field(detail, 'METODO_PAGO') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cliente {field(detail, 'CLIENTE_NOMBRE') || 'Consumidor Final'} · Cajero {field(detail, 'CAJERO_NOMBRE') || '—'} · Total {gtq(field(detail, 'TOTAL'))}
              </p>
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
