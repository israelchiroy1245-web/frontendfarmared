import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Ban, Eye, Minus, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button, buttonVariants } from '@/components/ui/button'
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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function hoy() {
  const fecha = new Date()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function ivaIncluido(total) {
  return Math.round(Number(total || 0) * 12 / 112 * 100) / 100
}

function loteVigente(row) {
  const cantidad = Number(field(row, 'CANTIDAD', 'Cantidad') || 0)
  if (!(cantidad > 0)) return false
  if (Number(field(row, 'VENCIDO')) === 1) return false
  const fecha = String(field(row, 'FECHA_VENCIMIENTO') || '')
  if (fecha && fecha < hoy()) return false
  return true
}

function agruparStock(filas) {
  const mapa = new Map()
  for (const row of filas) {
    if (!loteVigente(row)) continue
    const id = field(row, 'MEDICAMENTO_ID')
    if (id == null) continue
    const cantidad = Number(field(row, 'CANTIDAD', 'Cantidad') || 0)
    const fecha = String(field(row, 'FECHA_VENCIMIENTO') || '')
    const lote = field(row, 'LOTE', 'Lote') || ''
    const actual = mapa.get(id)
    if (!actual) {
      mapa.set(id, {
        medicamentoId: id,
        nombre: field(row, 'NOMBRE_MEDICAMENTO') || 'Medicamento',
        codigoBarra: field(row, 'CODIGO_BARRA') || '',
        lote,
        cantidad,
        fechaVencimiento: fecha,
        precio: Number(field(row, 'PRECIO_VENTA') || 0),
        lotes: 1,
      })
      continue
    }
    actual.cantidad += cantidad
    actual.lotes += 1
    if (fecha && (!actual.fechaVencimiento || fecha < actual.fechaVencimiento)) {
      actual.fechaVencimiento = fecha
      actual.lote = lote || actual.lote
    }
  }
  return [...mapa.values()]
}

export default function Ventas() {
  const cobrar = getRol() === 'ADMIN' || getRol() === 'CAJERO'
  const [params] = useSearchParams()
  const usuario = getUser()
  const [sucursales, setSucursales] = useState([])
  const [sucursalId, setSucursalId] = useState(
    () => params.get('sucursal') || String(usuario?.sucursalId || ''),
  )
  const [turno, setTurno] = useState(null)
  const [cajaCerrada, setCajaCerrada] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const busquedaDebounced = useDebounced(busqueda, 300)
  const [coincidencias, setCoincidencias] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [carrito, setCarrito] = useState([])
  const [nit, setNit] = useState('CF')
  const [nombreFactura, setNombreFactura] = useState('Consumidor Final')
  const [efectivo, setEfectivo] = useState('')
  const [tarjeta, setTarjeta] = useState('')
  const [transferencia, setTransferencia] = useState('')
  const [saving, setSaving] = useState(false)
  const [ticket, setTicket] = useState(null)

  const [ventas, setVentas] = useState([])
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [anularTarget, setAnularTarget] = useState(null)
  const [detail, setDetail] = useState(null)
  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const suc = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
  }, [])

  const loadVentas = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset, fechaDesde: hoy() }
    if (sucursalId) query.sucursalId = sucursalId
    const data = await api('/api/ventas', { query })
    if (id !== reqId.current) return
    setVentas(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
  }, [limit, offset, sucursalId])

  useEffect(() => {
    loadCatalogos().catch((e) => toast.error(e.message || 'No se cargaron los catálogos'))
  }, [loadCatalogos])

  useEffect(() => {
    const desdeUrl = params.get('sucursal')
    if (desdeUrl) setSucursalId(desdeUrl)
  }, [params])

  useEffect(() => {
    if (!sucursalId) {
      setTurno(null)
      setCajaCerrada(false)
      return undefined
    }
    let vivo = true
    api('/api/caja/abierta', { query: { sucursalId } })
      .then((data) => {
        if (!vivo) return
        setTurno(data.datos || data)
        setCajaCerrada(false)
      })
      .catch(() => {
        if (!vivo) return
        setTurno(null)
        setCajaCerrada(true)
      })
    return () => {
      vivo = false
    }
  }, [sucursalId])

  useEffect(() => {
    setOffset(0)
  }, [sucursalId, limit])

  useEffect(() => {
    loadVentas().catch((e) => toast.error(e.message || 'No se cargaron las ventas del día'))
  }, [loadVentas])

  const estimado = carrito.reduce((suma, linea) => suma + linea.precio * linea.cantidad, 0)
  const iva = ivaIncluido(estimado)
  const subtotal = Math.round((estimado - iva) * 100) / 100
  const pagosPreview = []
  if (Number(efectivo) > 0) pagosPreview.push(Number(efectivo))
  if (Number(tarjeta) > 0) pagosPreview.push(Number(tarjeta))
  if (Number(transferencia) > 0) pagosPreview.push(Number(transferencia))
  const recibido = pagosPreview.reduce((suma, n) => suma + n, 0) || estimado
  const vuelto = Math.max(0, Math.round((recibido - estimado) * 100) / 100)
  const puedeCarrito = cobrar && Boolean(turno)
  const consulta = busquedaDebounced.trim()

  useEffect(() => {
    if (!puedeCarrito || !sucursalId || !consulta) {
      setCoincidencias([])
      setBuscando(false)
      return undefined
    }
    let vivo = true
    setBuscando(true)
    api('/api/inventario', { query: { sucursalId, q: consulta, limit: 8 } })
      .then((data) => {
        if (!vivo) return
        const filas = Array.isArray(data?.datos) ? data.datos : []
        setCoincidencias(agruparStock(filas).slice(0, 8))
      })
      .catch((err) => {
        if (!vivo) return
        setCoincidencias([])
        toast.error(err.message || 'No se pudo buscar el inventario')
      })
      .finally(() => {
        if (vivo) setBuscando(false)
      })
    return () => {
      vivo = false
    }
  }, [consulta, puedeCarrito, sucursalId])

  function agregar(med) {
    const id = med.medicamentoId
    const precio = Number(med.precio || 0)
    setCarrito((prev) => {
      const ya = prev.find((linea) => linea.medicamentoId === id)
      if (ya) {
        return prev.map((linea) => (
          linea.medicamentoId === id ? { ...linea, cantidad: linea.cantidad + 1 } : linea
        ))
      }
      return [...prev, {
        medicamentoId: id,
        nombre: med.nombre || 'Medicamento',
        precio,
        cantidad: 1,
      }]
    })
    setBusqueda('')
    setCoincidencias([])
  }

  function cambiarCantidad(id, delta) {
    setCarrito((prev) => prev
      .map((linea) => (
        linea.medicamentoId === id ? { ...linea, cantidad: linea.cantidad + delta } : linea
      ))
      .filter((linea) => linea.cantidad > 0))
  }

  async function cobrarTicket(e) {
    e.preventDefault()
    if (!puedeCarrito || carrito.length === 0) return
    const pagos = []
    if (Number(efectivo) > 0) pagos.push({ metodoPago: 'EFECTIVO', monto: Number(efectivo) })
    if (Number(tarjeta) > 0) pagos.push({ metodoPago: 'TARJETA', monto: Number(tarjeta) })
    if (Number(transferencia) > 0) pagos.push({ metodoPago: 'TRANSFERENCIA', monto: Number(transferencia) })
    if (pagos.length === 0) pagos.push({ metodoPago: 'EFECTIVO', monto: estimado })
    const suma = pagos.reduce((acc, pago) => acc + pago.monto, 0)
    if (suma + 0.001 < estimado) {
      toast.error('Los pagos no cubren el total')
      return
    }
    setSaving(true)
    try {
      const data = await api('/api/ventas', {
        method: 'POST',
        body: {
          sucursalId: Number(sucursalId),
          tipoDoc: 'TICKET',
          nit: nit.trim() || 'CF',
          nombreFactura: nombreFactura.trim() || 'Consumidor Final',
          descuento: 0,
          montoRecibido: Number(efectivo) > 0 ? Number(efectivo) : estimado,
          items: carrito.map((linea) => ({ medicamentoId: linea.medicamentoId, cantidad: linea.cantidad })),
          pagos,
        },
      })
      setTicket(data)
      setCarrito([])
      setEfectivo('')
      setTarjeta('')
      setTransferencia('')
      toast.success(data.mensaje || `Ticket ${data.folio || ''} emitido`)
      await loadVentas()
    } catch (err) {
      toast.error(err.message || 'No se pudo cobrar')
    } finally {
      setSaving(false)
    }
  }

  async function confirmarAnular() {
    const id = field(anularTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/ventas/${id}/anular`, { method: 'POST' })
      toast.success(data.mensaje || 'Ticket anulado')
      setAnularTarget(null)
      await loadVentas()
    } catch (err) {
      toast.error(err.message || 'No se pudo anular')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetail(null)
    try {
      const data = await api(`/api/ventas/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo abrir el ticket')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · POS</p>
          <h1 className="font-display text-3xl">Punto de venta</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            El precio es el de anaquel. El lote lo elige el vencimiento y el cobro entra al turno abierto de la sucursal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
            <option value="">Sucursal</option>
            {sucursales.map((s) => (
              <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
            ))}
          </select>
          <Link to="/caja" className={buttonVariants({ variant: 'outline' })}>Ver turno</Link>
        </div>
      </div>

      {cajaCerrada ? (
        <Card>
          <CardHeader>
            <CardTitle>Caja cerrada</CardTitle>
            <CardDescription>Esta sucursal no puede cobrar hasta que alguien abra el turno.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/caja" className={buttonVariants()}>Ir a caja</Link>
          </CardContent>
        </Card>
      ) : null}

      {puedeCarrito ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Carrito</CardTitle>
              <CardDescription>Busca por nombre o código de barras.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o código de barras" />
              </div>
              {busqueda.trim() === consulta && consulta && !buscando && coincidencias.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay existencias en esta sucursal.</p>
              ) : null}
              {coincidencias.length > 0 ? (
                <div className="rounded-lg border border-border">
                  {coincidencias.map((med) => (
                    <button
                      key={med.medicamentoId}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => agregar(med)}
                    >
                      <span>
                        {med.nombre}
                        <span className="ml-2 text-xs text-muted-foreground">{med.codigoBarra}</span>
                        <span className="block text-xs text-muted-foreground">
                          Lote {med.lote || '—'}
                          {med.lotes > 1 ? ` · ${med.lotes} lotes` : ''}
                          {' · '}
                          {med.cantidad} u · vence {med.fechaVencimiento || '—'}
                        </span>
                      </span>
                      <span>{gtq(med.precio)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {carrito.length === 0 ? (
                <p className="text-sm text-muted-foreground">El carrito está vacío.</p>
              ) : carrito.map((linea) => (
                <div key={linea.medicamentoId} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{linea.nombre}</p>
                    <p className="text-xs text-muted-foreground">{gtq(linea.precio)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => cambiarCantidad(linea.medicamentoId, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-6 text-center text-sm">{linea.cantidad}</span>
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => cambiarCantidad(linea.medicamentoId, 1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobro</CardTitle>
              <CardDescription>
                Turno #{field(turno, 'ID') || '—'} · IVA incluido en el precio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={cobrarTicket} className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <p>Subtotal {gtq(subtotal)}</p>
                  <p>IVA {gtq(iva)}</p>
                  <p className="font-medium">Total {gtq(estimado)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nit">NIT</Label>
                    <Input id="nit" value={nit} onChange={(e) => setNit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nombreFactura">Nombre</Label>
                    <Input id="nombreFactura" value={nombreFactura} onChange={(e) => setNombreFactura(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="efectivo">Efectivo recibido</Label>
                    <Input id="efectivo" type="number" min="0" step="0.01" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} placeholder="Total" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tarjeta">Tarjeta</Label>
                    <Input id="tarjeta" type="number" min="0" step="0.01" value={tarjeta} onChange={(e) => setTarjeta(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="transferencia">Transferencia</Label>
                    <Input id="transferencia" type="number" min="0" step="0.01" value={transferencia} onChange={(e) => setTransferencia(e.target.value)} />
                  </div>
                  <p className="self-end text-sm text-muted-foreground">Vuelto {gtq(vuelto)}</p>
                </div>
                <Button type="submit" disabled={saving || carrito.length === 0}>
                  {saving ? 'Cobrando…' : 'Cobrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Tickets de hoy</CardTitle>
          <CardDescription>{total} en la sucursal elegida</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {ventas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay tickets hoy.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pagos</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ventas.map((row) => {
                  const id = field(row, 'ID')
                  const est = String(field(row, 'ESTADO') || '')
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'FOLIO') || '—'}</TableCell>
                      <TableCell>{field(row, 'NOMBRE_FACTURA') || 'Consumidor Final'}</TableCell>
                      <TableCell>{field(row, 'METODOS_PAGO') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL'))}</TableCell>
                      <TableCell>
                        <Badge variant={est === 'ANULADA' ? 'danger' : 'ok'}>{est || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {cobrar && est === 'EMITIDA' ? (
                            <Button type="button" variant="ghost" size="icon-sm" title="Anular" onClick={() => setAnularTarget(row)}>
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

      <Dialog open={Boolean(ticket)} onOpenChange={(open) => { if (!open) setTicket(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ticket {ticket?.folio || ''}</DialogTitle>
            <DialogDescription>{ticket?.mensaje || 'Venta emitida'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1 text-sm">
            <p>IVA {gtq(ticket?.iva)}</p>
            <p>Total {gtq(ticket?.total)}</p>
            <p>Vuelto {gtq(ticket?.vuelto)}</p>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setTicket(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => { if (!open) setDetail(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{field(detail, 'FOLIO') || 'Ticket'}</DialogTitle>
            <DialogDescription>
              IVA {gtq(field(detail, 'IVA'))} · Total {gtq(field(detail, 'TOTAL'))} · Vuelto {gtq(field(detail, 'VUELTO'))}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(anularTarget)} onOpenChange={(open) => { if (!open) setAnularTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular {field(anularTarget, 'FOLIO') || 'ticket'}</DialogTitle>
            <DialogDescription>El stock vuelve al lote y la caja deshace el cobro.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAnularTarget(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={confirmarAnular} disabled={saving}>Anular ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
