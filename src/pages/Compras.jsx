import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Buscador from '@/components/Buscador'
import SelectorBusqueda from '@/components/SelectorBusqueda'
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

function lineaVacia() {
  return { medicamentoId: '', cantidad: '1', lote: '', fechaVencimiento: '', precioCosto: '' }
}

function puedeRegistrar() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'QF' || rol === 'ENCARGADO'
}

export default function Compras() {
  const registrar = puedeRegistrar()
  const local = sucursalFijada()
  const [compras, setCompras] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [proveedores, setProveedores] = useState([])
  const [medicamentos, setMedicamentos] = useState([])
  const [sucursalId, setSucursalId] = useState(() => (sucursalFijada() ? sucursalAsignada() : ''))
  const [proveedorId, setProveedorId] = useState('')
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
  const [numeroFactura, setNumeroFactura] = useState('')
  const [formSucursal, setFormSucursal] = useState(() => (sucursalFijada() ? sucursalAsignada() : ''))
  const [formProveedor, setFormProveedor] = useState('')
  const [lineas, setLineas] = useState([lineaVacia()])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const [suc, prov, med] = await Promise.all([
      api('/api/catalogos/sucursales'),
      api('/api/catalogos/proveedores'),
      api('/api/catalogos/medicamentos'),
    ])
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
    setProveedores(Array.isArray(prov?.datos) ? prov.datos : [])
    setMedicamentos(Array.isArray(med?.datos) ? med.datos : [])
  }, [])

  const loadCompras = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (proveedorId) query.proveedorId = proveedorId
    if (fechaDesde) query.fechaDesde = fechaDesde
    if (fechaHasta) query.fechaHasta = fechaHasta
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/compras', { query })
    if (id !== reqId.current) return
    setCompras(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setMonto(Number(data?.resumen?.monto ?? 0))
  }, [limit, offset, sucursalId, proveedorId, fechaDesde, fechaHasta, qDebounced])

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
  }, [sucursalId, proveedorId, fechaDesde, fechaHasta, qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadCompras()
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
  }, [loadCompras])

  function abrirAlta() {
    setNumeroFactura('')
    setFormSucursal(sucursalId)
    setFormProveedor(proveedorId)
    setLineas([lineaVacia()])
    setFormOpen(true)
  }

  function setLinea(index, key, value) {
    setLineas((prev) => prev.map((linea, i) => (i === index ? { ...linea, [key]: value } : linea)))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!numeroFactura.trim() || !formSucursal || !formProveedor) {
      toast.error('Factura, proveedor y sucursal son obligatorios')
      return
    }
    const items = []
    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad)
      const precioCosto = Number(linea.precioCosto)
      if (!linea.medicamentoId || !linea.lote.trim() || !linea.fechaVencimiento) {
        toast.error('Cada línea necesita medicamento, lote y vencimiento')
        return
      }
      if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioCosto) || precioCosto < 0) {
        toast.error('La cantidad debe ser mayor a cero y el costo no puede ser negativo')
        return
      }
      items.push({
        medicamentoId: Number(linea.medicamentoId),
        cantidad,
        lote: linea.lote.trim(),
        vencimiento: linea.fechaVencimiento,
        costo: precioCosto,
      })
    }

    setSaving(true)
    try {
      await api('/api/compras', {
        method: 'POST',
        body: {
          numeroFactura: numeroFactura.trim(),
          proveedorId: Number(formProveedor),
          sucursalId: Number(formSucursal),
          lineas: items,
        },
      })
      toast.success('Compra registrada. El stock entró por procesar_compra')
      setFormOpen(false)
      await loadCompras()
    } catch (err) {
      toast.error(err.message || 'No se pudo registrar la compra')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/compras/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar la factura')
      setDetailOpen(false)
    }
  }

  if (loading && compras.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && compras.length === 0) {
    return <p className="text-destructive">No se pudieron cargar las compras: {error}</p>
  }

  const lineasDetalle = detail?.LINEAS || detail?.lineas || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · Compras</p>
          <h1 className="font-display text-3xl">Compras a proveedores</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Recepción de facturas. Cada línea entra al inventario por procesar_compra. La factura queda registrada y no se modifica.
          </p>
        </div>
        {registrar ? (
          <Button className="gap-2" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Registrar compra
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Facturas</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total con el filtro actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monto recibido</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(monto)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Suma de totales de factura</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Facturas de compra</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar factura, proveedor o sucursal…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} disabled={local} onChange={(e) => setSucursalId(e.target.value)}>
              {local ? null : <option value="">Todas las sucursales</option>}
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>
                  {field(s, 'Nombre')}
                </option>
              ))}
            </select>
            <select className={selectClass} aria-label="Proveedor" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {proveedores.map((p) => (
                <option key={field(p, 'ID')} value={field(p, 'ID')}>
                  {field(p, 'Nombre')}
                </option>
              ))}
            </select>
            <Input type="date" aria-label="Desde" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            <Input type="date" aria-label="Hasta" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {compras.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay facturas con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Recibió</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Líneas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.map((row) => {
                  const id = field(row, 'ID')
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'NUMERO_FACTURA') || '—'}</TableCell>
                      <TableCell>{field(row, 'FECHA_COMPRA') || '—'}</TableCell>
                      <TableCell>{field(row, 'PROVEEDOR_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'EMPLEADO_NOMBRE') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL_COMPRA'))}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{field(row, 'TOTAL_LINEAS') ?? 0}</Badge>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar compra</DialogTitle>
            <DialogDescription>
              La factura queda en F_Compras y cada línea llama a procesar_compra para subir el lote en la sucursal.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="numeroFactura">Nº factura</Label>
                <Input id="numeroFactura" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formProveedor">Proveedor</Label>
                <SelectorBusqueda
                  id="formProveedor"
                  items={proveedores.map((p) => ({
                    value: String(field(p, 'ID')),
                    label: field(p, 'Nombre') || '',
                    hint: field(p, 'NIT') || '',
                  }))}
                  value={formProveedor}
                  onChange={setFormProveedor}
                  placeholder="Buscar proveedor"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formSucursal">Sucursal que recibe</Label>
                <SelectorBusqueda
                  id="formSucursal"
                  items={sucursales.map((s) => ({
                    value: String(field(s, 'ID')),
                    label: field(s, 'Nombre') || '',
                    hint: field(s, 'Codigo') || '',
                  }))}
                  value={formSucursal}
                  onChange={setFormSucursal}
                  placeholder="Buscar sucursal"
                  disabled={local}
                />
              </div>
            </div>

            <div className="space-y-3">
              {lineas.map((linea, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Medicamento</Label>
                    <SelectorBusqueda
                      items={medicamentos.map((m) => ({
                        value: String(field(m, 'ID')),
                        label: field(m, 'NOMBRE_MEDICAMENTO') || '',
                        hint: field(m, 'CODIGO_BARRA') || '',
                      }))}
                      value={linea.medicamentoId}
                      onChange={(id) => setLinea(index, 'medicamentoId', id)}
                      placeholder="Buscar medicamento"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cantidad</Label>
                    <Input type="number" min="1" value={linea.cantidad} onChange={(e) => setLinea(index, 'cantidad', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lote</Label>
                    <Input value={linea.lote} onChange={(e) => setLinea(index, 'lote', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vence</Label>
                    <Input type="date" value={linea.fechaVencimiento} onChange={(e) => setLinea(index, 'fechaVencimiento', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Costo</Label>
                    <div className="flex gap-1">
                      <Input type="number" min="0" step="0.01" value={linea.precioCosto} onChange={(e) => setLinea(index, 'precioCosto', e.target.value)} />
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Registrando…' : 'Registrar factura'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{field(detail, 'NUMERO_FACTURA') || 'Factura'}</DialogTitle>
            <DialogDescription>
              {field(detail, 'PROVEEDOR_NOMBRE') || '—'} · {field(detail, 'SUCURSAL_NOMBRE') || '—'} · {field(detail, 'FECHA_COMPRA') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Total {gtq(field(detail, 'TOTAL_COMPRA'))} · Recibió {field(detail, 'EMPLEADO_NOMBRE') || '—'}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vence</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineasDetalle.map((linea) => (
                    <TableRow key={field(linea, 'ID')}>
                      <TableCell>{field(linea, 'NOMBRE_MEDICAMENTO') || '—'}</TableCell>
                      <TableCell>{field(linea, 'LOTE') || '—'}</TableCell>
                      <TableCell>{field(linea, 'FECHA_VENCIMIENTO') || '—'}</TableCell>
                      <TableCell>{field(linea, 'CANTIDAD')}</TableCell>
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
