import { useCallback, useEffect, useRef, useState } from 'react'
import { Pencil, Wallet } from 'lucide-react'
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

const ESTADOS = ['PENDIENTE', 'PAGADA']
const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function rol() {
  return getRol()
}

function periodoActual() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}`
}

export default function Planilla() {
  const ver = rol() === 'ADMIN' || rol() === 'AUDITOR'
  const admin = rol() === 'ADMIN'
  const [rows, setRows] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [periodo, setPeriodo] = useState(periodoActual())
  const [sucursalId, setSucursalId] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [monto, setMonto] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [ajuste, setAjuste] = useState(null)
  const [bonificaciones, setBonificaciones] = useState('')
  const [descuentos, setDescuentos] = useState('')
  const [salarioBase, setSalarioBase] = useState('')
  const [pagar, setPagar] = useState(null)
  const [pagarPeriodoOpen, setPagarPeriodoOpen] = useState(false)
  const reqId = useRef(0)

  const loadCatalogos = useCallback(async () => {
    const suc = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
  }, [])

  const loadPlanilla = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (periodo) query.periodo = periodo
    if (sucursalId) query.sucursalId = sucursalId
    if (estado) query.estado = estado
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/planilla', { query })
    if (id !== reqId.current) return
    setRows(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setMonto(Number(data?.resumen?.montoTotal ?? 0))
  }, [limit, offset, periodo, sucursalId, estado, qDebounced])

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
  }, [periodo, sucursalId, estado, qDebounced, limit])

  useEffect(() => {
    if (!ver) {
      setLoading(false)
      return undefined
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadPlanilla()
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
  }, [loadPlanilla, ver])

  async function generar() {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      toast.error('El periodo debe ser YYYY-MM')
      return
    }
    setSaving(true)
    try {
      const data = await api('/api/planilla/generar', {
        method: 'POST',
        body: {
          periodo,
          sucursalId: sucursalId ? Number(sucursalId) : undefined,
        },
      })
      toast.success(data.mensaje || 'Planilla generada')
      await loadPlanilla()
    } catch (err) {
      toast.error(err.message || 'No se pudo generar la planilla')
    } finally {
      setSaving(false)
    }
  }

  function abrirAjuste(row) {
    setAjuste(row)
    setBonificaciones(String(field(row, 'BONIFICACIONES') ?? ''))
    setDescuentos(String(field(row, 'DESCUENTOS') ?? ''))
    setSalarioBase(String(field(row, 'SALARIO_BASE') ?? ''))
  }

  async function guardarAjuste(e) {
    e.preventDefault()
    const id = field(ajuste, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/planilla/${id}`, {
        method: 'PATCH',
        body: {
          salarioBase: Number(salarioBase),
          bonificaciones: Number(bonificaciones) || 0,
          descuentos: Number(descuentos) || 0,
        },
      })
      toast.success(data.mensaje || 'Ajuste guardado')
      setAjuste(null)
      await loadPlanilla()
    } catch (err) {
      toast.error(err.message || 'No se pudo ajustar la planilla')
    } finally {
      setSaving(false)
    }
  }

  async function confirmarPago() {
    const id = field(pagar, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/planilla/${id}/pagar`, { method: 'PATCH' })
      toast.success(data.mensaje || 'Planilla pagada')
      setPagar(null)
      await loadPlanilla()
    } catch (err) {
      toast.error(err.message || 'No se pudo pagar')
    } finally {
      setSaving(false)
    }
  }

  async function pagarPeriodo() {
    setSaving(true)
    try {
      const data = await api('/api/planilla/pagar-periodo', {
        method: 'POST',
        body: {
          periodo,
          sucursalId: sucursalId ? Number(sucursalId) : undefined,
        },
      })
      toast.success(data.mensaje || 'Periodo pagado')
      setPagarPeriodoOpen(false)
      await loadPlanilla()
    } catch (err) {
      toast.error(err.message || 'No se pudo pagar el periodo')
    } finally {
      setSaving(false)
    }
  }

  if (!ver) {
    return <p className="text-destructive">Tu rol no puede consultar la planilla</p>
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
    return <p className="text-destructive">No se pudo cargar la planilla: {error}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Nomina · Planilla</p>
          <h1 className="font-display text-3xl">Planilla mensual</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            IGSS laboral 4.83% del salario base, la bonificacion de ley parte en Q 250 y el total es salario mas bonificaciones, menos descuentos e IGSS. Solo un registro pendiente se puede ajustar
          </p>
        </div>
        {admin ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={generar} disabled={saving}>Generar periodo</Button>
            <Button type="button" onClick={() => setPagarPeriodoOpen(true)} disabled={saving}>Pagar periodo</Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <CardDescription>Registros</CardDescription>
            <div className="rounded-md bg-secondary p-2 text-primary">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Periodo {periodo || 'todos'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total a pagar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{gtq(monto)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Comprobantes</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar empleado, cargo o sucursal…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input type="month" aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
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
            <p className="py-8 text-center text-sm text-muted-foreground">No hay planilla con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>IGSS</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = field(row, 'ID')
                  const est = String(field(row, 'ESTADO') || '')
                  return (
                    <TableRow key={id}>
                      <TableCell>{field(row, 'PERIODO') || '—'}</TableCell>
                      <TableCell>
                        <div className="font-medium">{field(row, 'EMPLEADO_NOMBRE') || '—'}</div>
                        <div className="text-xs text-muted-foreground">{field(row, 'EMPLEADO_CARGO') || ''}</div>
                      </TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'SALARIO_BASE'))}</TableCell>
                      <TableCell>{gtq(field(row, 'IGSS'))}</TableCell>
                      <TableCell>{gtq(field(row, 'TOTAL'))}</TableCell>
                      <TableCell>
                        <Badge variant={est === 'PAGADA' ? 'ok' : 'warn'}>{est || '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        {admin && est === 'PENDIENTE' ? (
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" title="Ajustar" onClick={() => abrirAjuste(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPagar(row)}>Pagar</Button>
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

      <Dialog open={Boolean(ajuste)} onOpenChange={(open) => { if (!open) setAjuste(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de {field(ajuste, 'EMPLEADO_NOMBRE') || 'planilla'}</DialogTitle>
            <DialogDescription>El servidor recalcula IGSS y el total a pagar</DialogDescription>
          </DialogHeader>
          <form onSubmit={guardarAjuste} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="salario">Salario base</Label>
              <Input id="salario" type="number" min="0" step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bono">Bonificaciones</Label>
              <Input id="bono" type="number" min="0" step="0.01" value={bonificaciones} onChange={(e) => setBonificaciones(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descuentos</Label>
              <Input id="desc" type="number" min="0" step="0.01" value={descuentos} onChange={(e) => setDescuentos(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAjuste(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ajuste'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pagar)} onOpenChange={(open) => { if (!open) setPagar(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar a {field(pagar, 'EMPLEADO_NOMBRE') || 'empleado'}</DialogTitle>
            <DialogDescription>El comprobante pasa a PAGADA y queda la fecha de pago</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPagar(null)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={confirmarPago} disabled={saving}>{saving ? 'Pagando…' : 'Confirmar pago'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pagarPeriodoOpen} onOpenChange={setPagarPeriodoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar periodo {periodo}</DialogTitle>
            <DialogDescription>
              Marca como pagadas las planillas pendientes de ese periodo{sucursalId ? ' en la sucursal filtrada' : ''}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPagarPeriodoOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={pagarPeriodo} disabled={saving}>{saving ? 'Pagando…' : 'Pagar pendientes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
