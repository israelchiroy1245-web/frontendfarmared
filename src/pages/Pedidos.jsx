import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const ESTADOS = ['NUEVO', 'CONFIRMADO', 'PREPARANDO', 'EN_RUTA', 'ENTREGADO', 'CANCELADO']
const SIGUIENTE = {
  NUEVO: 'CONFIRMADO',
  CONFIRMADO: 'PREPARANDO',
  PREPARANDO: 'EN_RUTA',
  EN_RUTA: 'ENTREGADO',
}
const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function puedeVer() {
  return ['CALL_CENTER', 'ADMIN', 'QF', 'CAJERO', 'AUDITOR'].includes(getRol())
}

function puedeMover() {
  return ['CALL_CENTER', 'ADMIN'].includes(getRol())
}

function badgeEstado(estado) {
  const valor = String(estado || '').toUpperCase()
  if (valor === 'ENTREGADO') return 'ok'
  if (valor === 'CANCELADO') return 'danger'
  if (valor === 'EN_RUTA') return 'gold'
  if (valor === 'PREPARANDO' || valor === 'CONFIRMADO') return 'warn'
  return 'secondary'
}

export default function Pedidos() {
  const ver = puedeVer()
  const mover = puedeMover()
  const [rows, setRows] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [estado, setEstado] = useState('')
  const [sucursalId, setSucursalId] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cambio, setCambio] = useState(null)
  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const suc = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
  }, [])

  const loadPedidos = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (estado) query.estado = estado
    if (sucursalId) query.sucursalId = sucursalId
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/pedidos', { query })
    if (id !== reqId.current) return
    setRows(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
  }, [limit, offset, estado, sucursalId, qDebounced])

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
  }, [estado, sucursalId, qDebounced, limit])

  useEffect(() => {
    if (!ver) {
      setLoading(false)
      return undefined
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadPedidos()
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
  }, [loadPedidos, ver])

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/pedidos/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el pedido')
      setDetailOpen(false)
    }
  }

  async function aplicarEstado() {
    if (!cambio) return
    setSaving(true)
    try {
      const data = await api(`/api/pedidos/${cambio.id}/estado`, {
        method: 'PATCH',
        body: { estado: cambio.estado },
      })
      toast.success(data.mensaje || 'Estado actualizado')
      setCambio(null)
      await loadPedidos()
    } catch (err) {
      toast.error(err.message || 'No se pudo cambiar el estado')
    } finally {
      setSaving(false)
    }
  }

  if (!ver) {
    return <p className="text-destructive">Tu rol no puede ver las entregas.</p>
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
    return <p className="text-destructive">No se pudieron cargar las entregas: {error}</p>
  }

  const items = detail?.ITEMS || []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Logística · Entregas</p>
        <h1 className="font-display text-3xl">Entregas a domicilio</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          El pedido avanza de confirmado a preparando, en ruta y entregado. Al entregar se sella la fecha. Un pedido entregado o cancelado ya no cambia.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Pedidos</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar cliente, sucursal o dirección…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectClass} aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {ESTADOS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = field(row, 'ID')
                  const est = String(field(row, 'ESTADO') || '')
                  const siguiente = SIGUIENTE[est]
                  const terminal = est === 'ENTREGADO' || est === 'CANCELADO'
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">#{id}</TableCell>
                      <TableCell>{field(row, 'CLIENTE_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'ETA_MINUTOS') != null ? `${field(row, 'ETA_MINUTOS')} min` : '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL_PEDIDO'))}</TableCell>
                      <TableCell>
                        <Badge variant={badgeEstado(est)}>{est || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {mover && siguiente ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setCambio({ id, estado: siguiente, etiqueta: siguiente })}>
                              {siguiente === 'ENTREGADO' ? 'Entregar' : 'Avanzar'}
                            </Button>
                          ) : null}
                          {mover && !terminal ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setCambio({ id, estado: 'CANCELADO', etiqueta: 'CANCELADO' })}>
                              Cancelar
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pedido {field(detail, 'ID') ? `#${field(detail, 'ID')}` : ''}</DialogTitle>
            <DialogDescription>
              {field(detail, 'SUCURSAL_NOMBRE') || '—'} · ETA {field(detail, 'ETA_MINUTOS') ?? '—'} min · {field(detail, 'ESTADO') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {field(detail, 'CLIENTE_NOMBRE') || '—'} · {field(detail, 'DIRECCION_ENTREGA') || '—'} · {field(detail, 'DEPARTAMENTO') || '—'}
              </p>
              <p className="text-sm">Promesa {field(detail, 'FECHA_PROMESA') || '—'} · Entrega {field(detail, 'FECHA_ENTREGA') || '—'} · Total {gtq(field(detail, 'TOTAL'))}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicamento</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((linea) => (
                    <TableRow key={field(linea, 'ID')}>
                      <TableCell>{field(linea, 'MEDICAMENTO_NOMBRE') || '—'}</TableCell>
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

      <Dialog open={Boolean(cambio)} onOpenChange={(open) => { if (!open) setCambio(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pasar pedido #{cambio?.id} a {cambio?.etiqueta}</DialogTitle>
            <DialogDescription>
              {cambio?.estado === 'ENTREGADO'
                ? 'Se registra la fecha de entrega.'
                : 'El ciclo es confirmado, preparando, en ruta y entregado.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCambio(null)} disabled={saving}>Volver</Button>
            <Button type="button" variant={cambio?.estado === 'CANCELADO' ? 'destructive' : 'default'} onClick={aplicarEstado} disabled={saving}>
              {saving ? 'Guardando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
