import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardCheck, Eye, Plus, Wallet } from 'lucide-react'
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

const ESTADOS = ['ABIERTA', 'CERRADA', 'AUDITADA']
const TIPOS_MOV = ['GASTO', 'RETIRO', 'DEPOSITO']

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function rolActual() {
  return getRol()
}

function puedeOperar() {
  const rol = rolActual()
  return rol === 'ADMIN' || rol === 'CAJERO'
}

function puedeAuditar() {
  const rol = rolActual()
  return rol === 'ADMIN' || rol === 'AUDITOR'
}

function badgeEstado(estado) {
  const e = String(estado || '').toUpperCase()
  if (e === 'ABIERTA') return 'ok'
  if (e === 'CERRADA') return 'warn'
  if (e === 'AUDITADA') return 'gold'
  return 'secondary'
}

export default function Caja() {
  const operar = puedeOperar()
  const auditar = puedeAuditar()
  const [turnos, setTurnos] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [activo, setActivo] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [sucursalId, setSucursalId] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [abiertos, setAbiertos] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [abrirOpen, setAbrirOpen] = useState(false)
  const [formSucursal, setFormSucursal] = useState('')
  const [montoInicial, setMontoInicial] = useState('')

  const [movOpen, setMovOpen] = useState(false)
  const [tipoMov, setTipoMov] = useState('GASTO')
  const [montoMov, setMontoMov] = useState('')
  const [descMov, setDescMov] = useState('')

  const [cierreOpen, setCierreOpen] = useState(false)
  const [montoContado, setMontoContado] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const [auditOpen, setAuditOpen] = useState(false)
  const [auditTarget, setAuditTarget] = useState(null)

  const reqId = useRef(0)

  const loadSucursales = useCallback(async () => {
    const data = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(data?.datos) ? data.datos : [])
  }, [])

  const loadActivo = useCallback(async () => {
    try {
      const data = await api('/api/caja/activo')
      setActivo(data.datos || null)
    } catch (e) {
      if (/no hay turno/i.test(e.message)) setActivo(null)
      else throw e
    }
  }, [])

  const loadAbierta = useCallback(async () => {
    if (!sucursalId) {
      setAbierta(null)
      return
    }
    try {
      const data = await api('/api/caja/abierta', { query: { sucursalId } })
      setAbierta(data.datos || null)
    } catch (e) {
      if (/no hay turno/i.test(e.message)) setAbierta(null)
      else throw e
    }
  }, [sucursalId])

  const loadTurnos = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (sucursalId) query.sucursalId = sucursalId
    if (estado) query.estado = estado
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/caja', { query })
    if (id !== reqId.current) return
    setTurnos(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    setAbiertos(Number(data?.resumen?.abiertos ?? 0))
  }, [limit, offset, sucursalId, estado, qDebounced])

  useEffect(() => {
    setOffset(0)
  }, [sucursalId, estado, qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await Promise.all([loadSucursales(), loadActivo(), loadAbierta(), loadTurnos()])
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
  }, [loadSucursales, loadActivo, loadAbierta, loadTurnos])

  async function refrescar() {
    await Promise.all([loadActivo(), loadAbierta(), loadTurnos()])
  }

  async function handleAbrir(e) {
    e.preventDefault()
    const monto = Number(montoInicial)
    if (!formSucursal) {
      toast.error('La sucursal es obligatoria')
      return
    }
    if (!Number.isFinite(monto) || monto < 0) {
      toast.error('El fondo inicial debe ser mayor o igual a cero')
      return
    }
    setSaving(true)
    try {
      const data = await api('/api/caja/abrir', {
        method: 'POST',
        body: { sucursalId: Number(formSucursal), montoInicial: monto },
      })
      toast.success(data.mensaje || 'Turno abierto')
      setAbrirOpen(false)
      await refrescar()
    } catch (err) {
      toast.error(err.message || 'No se pudo abrir el turno')
    } finally {
      setSaving(false)
    }
  }

  async function handleMovimiento(e) {
    e.preventDefault()
    const id = field(activo, 'ID')
    const monto = Number(montoMov)
    if (!id) return
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('El monto debe ser mayor a cero')
      return
    }
    if (!descMov.trim()) {
      toast.error('La descripción es obligatoria')
      return
    }
    setSaving(true)
    try {
      const data = await api(`/api/caja/${id}/movimiento`, {
        method: 'POST',
        body: { tipo: tipoMov, monto, descripcion: descMov.trim(), metodoPago: 'EFECTIVO' },
      })
      toast.success(data.mensaje || 'Movimiento registrado')
      setMovOpen(false)
      await refrescar()
    } catch (err) {
      toast.error(err.message || 'No se pudo registrar el movimiento')
    } finally {
      setSaving(false)
    }
  }

  async function handleCierre(e) {
    e.preventDefault()
    const id = field(activo, 'ID')
    const contado = Number(montoContado)
    if (!id) return
    if (!Number.isFinite(contado) || contado < 0) {
      toast.error('El monto contado es obligatorio y debe ser mayor o igual a cero')
      return
    }
    setSaving(true)
    try {
      const data = await api(`/api/caja/${id}/cerrar`, {
        method: 'PATCH',
        body: { montoContado: contado },
      })
      toast.success(data.mensaje || 'Turno cerrado')
      setCierreOpen(false)
      await refrescar()
    } catch (err) {
      toast.error(err.message || 'No se pudo cerrar el turno')
    } finally {
      setSaving(false)
    }
  }

  async function handleAuditar() {
    const id = field(auditTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      const data = await api(`/api/caja/${id}/auditar`, { method: 'PATCH' })
      toast.success(data.mensaje || 'Turno auditado')
      setAuditOpen(false)
      setAuditTarget(null)
      await refrescar()
    } catch (err) {
      toast.error(err.message || 'No se pudo auditar el turno')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/caja/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el turno')
      setDetailOpen(false)
    }
  }

  if (loading && turnos.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && turnos.length === 0) {
    return <p className="text-destructive">No se pudieron cargar los turnos: {error}</p>
  }

  const movimientos = detail?.MOVIMIENTOS || detail?.movimientos || []
  const esperado = activo
    ? Number(field(activo, 'MONTO_INICIAL') || 0) + Number(field(activo, 'VENTAS_EFECTIVO') || 0) - Number(field(activo, 'GASTOS') || 0)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Gerencial · Caja</p>
          <h1 className="font-display text-3xl">Caja y turnos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Cada sucursal tiene un solo turno abierto. Sin ese turno no se puede cobrar. El esperado es fondo más efectivo menos gastos, y el auditor marca el cierre.
          </p>
        </div>
        {operar && !activo ? (
          <Button
            className="gap-2"
            onClick={() => {
              setFormSucursal(sucursalId)
              setMontoInicial('')
              setAbrirOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Abrir turno
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div>
            <CardDescription>Tu turno</CardDescription>
            <CardTitle className="mt-1">
              {activo ? `Abierto en ${field(activo, 'SUCURSAL_NOMBRE')}` : 'Sin turno abierto'}
            </CardTitle>
          </div>
          <div className="rounded-md bg-secondary p-2 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {activo ? (
            <>
              <p className="text-sm text-muted-foreground">
                Fondo {gtq(field(activo, 'MONTO_INICIAL'))} · Efectivo {gtq(field(activo, 'VENTAS_EFECTIVO'))} · Gastos {gtq(field(activo, 'GASTOS'))} · Esperado {gtq(esperado)}
              </p>
              {operar ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTipoMov('GASTO')
                      setMontoMov('')
                      setDescMov('')
                      setMovOpen(true)
                    }}
                  >
                    Registrar movimiento
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setMontoContado('')
                      setCierreOpen(true)
                    }}
                  >
                    Cerrar turno
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No tienes un turno abierto. Una sucursal solo admite uno a la vez.</p>
          )}
        </CardContent>
      </Card>

      {sucursalId && (!abierta || field(abierta, 'ID') !== field(activo, 'ID')) ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Turno de la sucursal</CardDescription>
            <CardTitle className="mt-1">
              {abierta
                ? `Abierto por ${field(abierta, 'CAJERO_NOMBRE') || '—'}`
                : 'Sin turno abierto'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {abierta ? (
              <p className="text-sm text-muted-foreground">
                Fondo {gtq(field(abierta, 'MONTO_INICIAL'))} · Efectivo {gtq(field(abierta, 'VENTAS_EFECTIVO'))} · Gastos {gtq(field(abierta, 'GASTOS'))}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Esta sucursal no puede cobrar hasta que alguien abra la caja.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Turnos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{total}</p>
            <p className="mt-1 text-xs text-muted-foreground">Total con el filtro actual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abiertos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-semibold">{abiertos}</p>
            <p className="mt-1 text-xs text-muted-foreground">Turnos en estado ABIERTA</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Turnos de caja</CardTitle>
              <CardDescription>{total} registros</CardDescription>
            </div>
            <Buscador value={q} onChange={setQ} placeholder="Buscar sucursal o cajero…" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {sucursales.map((s) => (
                <option key={field(s, 'ID')} value={field(s, 'ID')}>
                  {field(s, 'Nombre')}
                </option>
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
          {turnos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay turnos con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apertura</TableHead>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Cerró</TableHead>
                  <TableHead>Diferencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turnos.map((row) => {
                  const id = field(row, 'ID')
                  const est = String(field(row, 'ESTADO') || '')
                  return (
                    <TableRow key={id}>
                      <TableCell>{field(row, 'FECHA_APERTURA') || '—'}</TableCell>
                      <TableCell>{field(row, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'CAJERO_NOMBRE') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={badgeEstado(est)}>{est || '—'}</Badge>
                      </TableCell>
                      <TableCell>{field(row, 'TOTAL_ESPERADO') == null ? '—' : gtq(field(row, 'TOTAL_ESPERADO'))}</TableCell>
                      <TableCell>{field(row, 'CERRADO_POR_NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'DIFERENCIA') == null ? '—' : gtq(field(row, 'DIFERENCIA'))}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {auditar && est === 'CERRADA' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Auditar"
                              onClick={() => {
                                setAuditTarget(row)
                                setAuditOpen(true)
                              }}
                            >
                              <ClipboardCheck className="h-4 w-4" />
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

      <Dialog open={abrirOpen} onOpenChange={setAbrirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir turno</DialogTitle>
            <DialogDescription>El fondo inicial queda como depósito de apertura. La sucursal no puede tener otro turno abierto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbrir} className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sucursalTurno">Sucursal</Label>
              <select id="sucursalTurno" className={selectClass} value={formSucursal} onChange={(e) => setFormSucursal(e.target.value)}>
                <option value="">Selecciona</option>
                {sucursales.map((s) => (
                  <option key={field(s, 'ID')} value={field(s, 'ID')}>
                    {field(s, 'Nombre')}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fondoInicial">Fondo inicial</Label>
              <Input id="fondoInicial" type="number" min="0" step="0.01" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAbrirOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Abriendo…' : 'Abrir'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Movimiento de caja</DialogTitle>
            <DialogDescription>Gasto, retiro o depósito en efectivo. Un gasto se suma al arqueo del turno.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMovimiento} className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tipoMov">Tipo</Label>
              <select id="tipoMov" className={selectClass} value={tipoMov} onChange={(e) => setTipoMov(e.target.value)}>
                {TIPOS_MOV.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="montoMov">Monto</Label>
              <Input id="montoMov" type="number" min="0.01" step="0.01" value={montoMov} onChange={(e) => setMontoMov(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="descMov">Descripción</Label>
              <Input id="descMov" value={descMov} onChange={(e) => setDescMov(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMovOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cierreOpen} onOpenChange={setCierreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cerrar turno</DialogTitle>
            <DialogDescription>
              Esperado en caja: {gtq(esperado)}. La diferencia es el monto contado menos ese valor.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCierre} className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="montoContado">Monto contado</Label>
              <Input id="montoContado" type="number" min="0" step="0.01" value={montoContado} onChange={(e) => setMontoContado(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCierreOpen(false)} disabled={saving}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Cerrando…' : 'Cerrar turno'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Turno {field(detail, 'ID') ? `#${field(detail, 'ID')}` : ''}</DialogTitle>
            <DialogDescription>
              {field(detail, 'SUCURSAL_NOMBRE') || '—'} · {field(detail, 'CAJERO_NOMBRE') || '—'} · {field(detail, 'ESTADO') || '—'}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Apertura {field(detail, 'FECHA_APERTURA') || '—'} · Cierre {field(detail, 'FECHA_CIERRE') || '—'}
              </p>
              <p className="text-sm">
                Fondo {gtq(field(detail, 'MONTO_INICIAL'))} · Efectivo {gtq(field(detail, 'VENTAS_EFECTIVO'))} · Tarjeta {gtq(field(detail, 'VENTAS_TARJETA'))} · Gastos {gtq(field(detail, 'GASTOS'))} · Esperado {field(detail, 'TOTAL_ESPERADO') == null ? '—' : gtq(field(detail, 'TOTAL_ESPERADO'))}
              </p>
              {field(detail, 'CERRADO_POR_NOMBRE') ? (
                <p className="text-sm text-muted-foreground">Cerró {field(detail, 'CERRADO_POR_NOMBRE')}</p>
              ) : null}
              <p className="text-sm">
                Contado {field(detail, 'MONTO_CONTADO') == null ? '—' : gtq(field(detail, 'MONTO_CONTADO'))} · Diferencia {field(detail, 'DIFERENCIA') == null ? '—' : gtq(field(detail, 'DIFERENCIA'))}
              </p>
              {field(detail, 'AUDITOR_NOMBRE') ? (
                <p className="text-sm text-muted-foreground">
                  Auditó {field(detail, 'AUDITOR_NOMBRE')} · {field(detail, 'FECHA_AUDITORIA') || '—'}
                </p>
              ) : null}
              {movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimientos.map((mov) => (
                      <TableRow key={field(mov, 'ID')}>
                        <TableCell>{field(mov, 'FECHA') || '—'}</TableCell>
                        <TableCell>{field(mov, 'TIPO') || '—'}</TableCell>
                        <TableCell>{field(mov, 'DESCRIPCION') || '—'}</TableCell>
                        <TableCell>{gtq(field(mov, 'MONTO'))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Auditar turno</DialogTitle>
            <DialogDescription>El turno pasa a AUDITADA. Solo se audita un cierre, no un turno abierto.</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Auditar el turno de <span className="font-medium">{field(auditTarget, 'CAJERO_NOMBRE')}</span> en {field(auditTarget, 'SUCURSAL_NOMBRE')}?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAuditOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={handleAuditar} disabled={saving}>{saving ? 'Auditando…' : 'Auditar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
