import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Eye, Package, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api, fmtDate, gtq } from '@/lib/utils'
import { getRol, sucursalAsignada, sucursalFijada } from '@/lib/roles'
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

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const emptyForm = {
  sucursalId: '',
  medicamentoId: '',
  lote: '',
  cantidad: '0',
  stockMinimo: '6',
  fechaVencimiento: '',
}

function puedeEscribir() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'QF' || rol === 'ENCARGADO'
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

export default function Inventario() {
  const escribir = puedeEscribir()
  const local = sucursalFijada()
  const [vista, setVista] = useState('lotes')
  const [lotes, setLotes] = useState([])
  const [kardex, setKardex] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [medicamentos, setMedicamentos] = useState([])
  const [sucursalId, setSucursalId] = useState(() => (sucursalFijada() ? sucursalAsignada() : ''))
  const [soloBajo, setSoloBajo] = useState(false)
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offsetLotes, setOffsetLotes] = useState(0)
  const [offsetKardex, setOffsetKardex] = useState(0)
  const [totalLotes, setTotalLotes] = useState(0)
  const [totalKardex, setTotalKardex] = useState(0)
  const [resumen, setResumen] = useState({ bajos: 0, vencidos: 0, porVencer: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteTarget, setAjusteTarget] = useState(null)
  const [ajusteValor, setAjusteValor] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const loadCatalogos = useCallback(async () => {
    const [suc, med] = await Promise.all([
      api('/api/catalogos/sucursales'),
      api('/api/catalogos/medicamentos'),
    ])
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
    setMedicamentos(Array.isArray(med?.datos) ? med.datos : [])
  }, [])

  const loteReq = useRef(0)
  const kardexReq = useRef(0)

  const loadLotes = useCallback(async () => {
    const reqId = ++loteReq.current
    const query = { limit, offset: offsetLotes }
    if (sucursalId) query.sucursalId = sucursalId
    if (soloBajo) query.alertaBajo = 'true'
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/inventario', { query })
    if (reqId !== loteReq.current) return
    setLotes(Array.isArray(data?.datos) ? data.datos : [])
    setTotalLotes(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setResumen({
      bajos: Number(data?.resumen?.bajos ?? 0),
      vencidos: Number(data?.resumen?.vencidos ?? 0),
      porVencer: Number(data?.resumen?.porVencer ?? 0),
    })
  }, [sucursalId, soloBajo, qDebounced, limit, offsetLotes])

  const loadKardex = useCallback(async () => {
    const reqId = ++kardexReq.current
    const query = { limit, offset: offsetKardex }
    if (sucursalId) query.sucursalId = sucursalId
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/inventario/kardex', { query })
    if (reqId !== kardexReq.current) return
    setKardex(Array.isArray(data?.datos) ? data.datos : [])
    setTotalKardex(Number(data?.paginacion?.total ?? data?.total ?? 0))
  }, [sucursalId, qDebounced, limit, offsetKardex])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadCatalogos()
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
  }, [loadCatalogos])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (vista === 'kardex') await loadKardex()
        else await loadLotes()
        if (alive) setError(null)
      } catch (e) {
        if (alive) setError(e.message)
      }
    })()
    return () => {
      alive = false
    }
  }, [vista, loadLotes, loadKardex])

  const filtrados = vista === 'kardex' ? kardex : lotes
  const stats = { total: totalLotes, bajos: resumen.bajos, vencidos: resumen.vencidos, porVencer: resumen.porVencer }

  useEffect(() => {
    setOffsetLotes(0)
    setOffsetKardex(0)
  }, [sucursalId, soloBajo, qDebounced, limit])

  function setFormField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.sucursalId || !form.medicamentoId || !form.lote.trim()) {
      toast.error('sucursal, medicamento y lote son obligatorios')
      return
    }
    const cantidad = Number(form.cantidad)
    if (!Number.isFinite(cantidad) || cantidad < 0) {
      toast.error('La cantidad no puede ser negativa')
      return
    }
    setSaving(true)
    try {
      await api('/api/inventario', {
        method: 'POST',
        body: {
          sucursalId: Number(form.sucursalId),
          medicamentoId: Number(form.medicamentoId),
          lote: form.lote.trim(),
          cantidad,
          stockMinimo: Number(form.stockMinimo || 6),
          fechaVencimiento: form.fechaVencimiento || undefined,
        },
      })
      toast.success('Lote creado')
      setFormOpen(false)
      await loadLotes()
    } catch (err) {
      toast.error(err.message || 'No se pudo crear el lote')
    } finally {
      setSaving(false)
    }
  }

  async function handleAjuste(e) {
    e.preventDefault()
    const id = field(ajusteTarget, 'ID')
    const cantidad = Number(ajusteValor)
    if (!id || !Number.isFinite(cantidad) || cantidad < 0) {
      toast.error('Indica una cantidad válida')
      return
    }
    setSaving(true)
    try {
      await api(`/api/inventario/${id}`, {
        method: 'PATCH',
        body: { cantidad },
      })
      toast.success('Stock ajustado')
      setAjusteOpen(false)
      await loadLotes()
    } catch (err) {
      toast.error(err.message || 'No se pudo ajustar el stock')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/inventario/${id}`, { method: 'DELETE' })
      toast.success('Lote eliminado')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadLotes()
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el lote')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/inventario/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el lote')
      setDetailOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && lotes.length === 0 && kardex.length === 0) {
    return <p className="text-destructive">No se pudo cargar el inventario: {error}</p>
  }

  const nombreSucursal =
    field(
      sucursales.find((s) => String(field(s, 'ID')) === String(sucursalId)),
      'Nombre',
    ) || 'tu sucursal'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Red · Inventario</p>
          <h1 className="font-display text-3xl">
            {local ? `Lotes de ${nombreSucursal}` : 'Inventario y lotes'}
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            {local
              ? 'Existencias de este local, por lote y vencimiento. Las salidas automáticas usan FEFO.'
              : 'Stock por sucursal, lote y vencimiento'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={vista === 'lotes' ? 'default' : 'outline'} onClick={() => setVista('lotes')}>
            Lotes
          </Button>
          <Button variant={vista === 'kardex' ? 'default' : 'outline'} onClick={() => setVista('kardex')}>
            Kardex
          </Button>
          {escribir && vista === 'lotes' ? (
            <Button
              className="gap-2"
              onClick={() => {
                setForm({ ...emptyForm, sucursalId })
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" />
              Nuevo lote
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Package} label="Lotes" value={stats.total} hint="Total con el filtro actual" />
        <Kpi icon={AlertTriangle} label="Stock bajo" value={stats.bajos} hint="Cantidad en o bajo el mínimo" />
        <Kpi icon={AlertTriangle} label="Por vencer" value={stats.porVencer} hint="Vence en 90 días o menos" />
        <Kpi icon={AlertTriangle} label="Vencidos" value={stats.vencidos} hint="Fecha de vencimiento pasada" />
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>{vista === 'kardex' ? 'Movimientos' : 'Existencias'}</CardTitle>
            <CardDescription>
              {vista === 'kardex' ? totalKardex : totalLotes} registros
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className={selectClass}
              value={sucursalId}
              disabled={local}
              onChange={(e) => {
                setSucursalId(e.target.value)
                setOffsetLotes(0)
                setOffsetKardex(0)
              }}
              aria-label="Sucursal"
            >
              {local ? null : <option value="">Todas las sucursales</option>}
              {sucursales.map((s) => {
                const id = field(s, 'ID')
                return (
                  <option key={id} value={id}>
                    {field(s, 'Codigo')} · {field(s, 'Nombre')}
                  </option>
                )
              })}
            </select>
            {vista === 'lotes' ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={soloBajo}
                  onChange={(e) => {
                    setSoloBajo(e.target.checked)
                    setOffsetLotes(0)
                  }}
                />
                Solo stock bajo
              </label>
            ) : null}
            <Buscador value={q} onChange={setQ} placeholder="Buscar lote o producto…" />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay registros con ese filtro.</p>
          ) : vista === 'kardex' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Referencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((row) => (
                  <TableRow key={field(row, 'ID')}>
                    <TableCell>{fmtDate(field(row, 'FECHA'))}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{field(row, 'Tipo') || '—'}</Badge>
                    </TableCell>
                    <TableCell>{field(row, 'NOMBRE_MEDICAMENTO') || '—'}</TableCell>
                    <TableCell>{field(row, 'Lote') || '—'}</TableCell>
                    <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                    <TableCell>{field(row, 'Cantidad') ?? '—'}</TableCell>
                    <TableCell>{field(row, 'Referencia') || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((row) => {
                  const id = field(row, 'ID')
                  const cantidad = Number(field(row, 'Cantidad') || 0)
                  const bajo = Number(field(row, 'STOCK_BAJO') || 0) === 1
                  const vencido = Number(field(row, 'VENCIDO') || 0) === 1
                  const porVencer = Number(field(row, 'POR_VENCER') || 0) === 1
                  return (
                    <TableRow key={id}>
                      <TableCell>
                        <p className="font-medium">{field(row, 'NOMBRE_MEDICAMENTO') || '—'}</p>
                        <p className="text-xs text-muted-foreground">{field(row, 'CODIGO_BARRA')}</p>
                      </TableCell>
                      <TableCell>{field(row, 'Lote') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>
                        {cantidad}
                        <span className="text-muted-foreground"> / {field(row, 'STOCK_MINIMO')}</span>
                      </TableCell>
                      <TableCell>{field(row, 'FECHA_VENCIMIENTO') || '—'}</TableCell>
                      <TableCell>
                        {vencido ? <Badge variant="danger">Vencido</Badge> : null}
                        {!vencido && porVencer ? <Badge variant="warn">Por vencer</Badge> : null}
                        {bajo ? <Badge variant="warn">Stock bajo</Badge> : null}
                        {!vencido && !porVencer && !bajo ? <Badge variant="ok">Ok</Badge> : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {escribir ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Ajustar stock"
                              onClick={() => {
                                setAjusteTarget(row)
                                setAjusteValor(String(cantidad))
                                setAjusteOpen(true)
                              }}
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {escribir ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title={cantidad > 0 ? 'Solo se elimina un lote en cero' : 'Eliminar'}
                              disabled={cantidad > 0}
                              onClick={() => {
                                setDeleteTarget(row)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className={`h-4 w-4 ${cantidad > 0 ? '' : 'text-destructive'}`} />
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
            total={vista === 'kardex' ? totalKardex : totalLotes}
            limit={limit}
            offset={vista === 'kardex' ? offsetKardex : offsetLotes}
            onChange={({ limit: nextLimit, offset: nextOffset }) => {
              setLimit(nextLimit)
              if (vista === 'kardex') setOffsetKardex(nextOffset)
              else setOffsetLotes(nextOffset)
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo lote</DialogTitle>
            <DialogDescription>Si la cantidad es mayor a cero, queda una entrada en el kardex</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sucursalId">Sucursal</Label>
              <SelectorBusqueda
                id="sucursalId"
                items={sucursales.map((s) => ({
                  value: String(field(s, 'ID')),
                  label: field(s, 'Nombre') || '',
                  hint: field(s, 'Codigo') || '',
                }))}
                value={form.sucursalId}
                onChange={(id) => setFormField('sucursalId', id)}
                placeholder="Buscar sucursal"
                disabled={local}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medicamentoId">Medicamento</Label>
              <SelectorBusqueda
                id="medicamentoId"
                items={medicamentos.map((m) => ({
                  value: String(field(m, 'ID')),
                  label: field(m, 'NOMBRE_MEDICAMENTO') || '',
                  hint: field(m, 'CODIGO_BARRA') || '',
                }))}
                value={form.medicamentoId}
                onChange={(id) => setFormField('medicamentoId', id)}
                placeholder="Buscar medicamento"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lote">Lote</Label>
                <Input id="lote" value={form.lote} onChange={(e) => setFormField('lote', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fechaVencimiento">Vencimiento</Label>
                <Input id="fechaVencimiento" type="date" value={form.fechaVencimiento} onChange={(e) => setFormField('fechaVencimiento', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cantidad">Cantidad</Label>
                <Input id="cantidad" type="number" min="0" value={form.cantidad} onChange={(e) => setFormField('cantidad', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stockMinimo">Stock mínimo</Label>
                <Input id="stockMinimo" type="number" min="0" value={form.stockMinimo} onChange={(e) => setFormField('stockMinimo', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Crear lote'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              Nueva cantidad absoluta del lote {field(ajusteTarget, 'Lote')} Queda registrado como AJUSTE en el kardex
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAjuste} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ajusteValor">Cantidad</Label>
              <Input id="ajusteValor" type="number" min="0" value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAjusteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ajuste'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar lote</DialogTitle>
            <DialogDescription>
              Solo se elimina si la cantidad es cero. ¿Eliminar el lote {field(deleteTarget, 'Lote')}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={handleDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{field(detail, 'NOMBRE_MEDICAMENTO') || 'Lote'}</DialogTitle>
            <DialogDescription>GET /api/inventario/:id</DialogDescription>
          </DialogHeader>
          {detail ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Lote', field(detail, 'Lote')],
                ['Sucursal', field(detail, 'SUCURSAL_NOMBRE')],
                ['Cantidad', field(detail, 'Cantidad')],
                ['Mínimo', field(detail, 'STOCK_MINIMO')],
                ['Vence', field(detail, 'FECHA_VENCIMIENTO')],
                ['Precio', field(detail, 'PRECIO_VENTA') != null ? gtq(field(detail, 'PRECIO_VENTA')) : '—'],
                ['Costo', field(detail, 'COSTO') != null ? gtq(field(detail, 'COSTO')) : '—'],
                ['Laboratorio', field(detail, 'LABORATORIO')],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right">{value ?? '—'}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
