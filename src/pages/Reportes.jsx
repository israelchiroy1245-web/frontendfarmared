import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import Buscador from '@/components/Buscador'
import Paginacion from '@/components/Paginacion'
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

const REPORTES = [
  { id: 'consolidado', label: 'Consolidado de red', path: '/api/reportes/consolidado-red', roles: ['ADMIN', 'AUDITOR', 'QF'] },
  { id: 'ventas', label: 'Ventas', path: '/api/reportes/ventas', roles: ['ADMIN', 'AUDITOR', 'QF'] },
  { id: 'inventario', label: 'Inventario FEFO', path: '/api/reportes/inventario', roles: ['ADMIN', 'AUDITOR', 'QF'] },
  { id: 'caja', label: 'Arqueo de caja', path: '/api/reportes/caja', roles: ['ADMIN', 'AUDITOR'] },
  { id: 'planilla', label: 'Planilla', path: '/api/reportes/planilla', roles: ['ADMIN', 'AUDITOR'] },
  { id: 'activos', label: 'Activos', path: '/api/reportes/activos', roles: ['ADMIN', 'AUDITOR', 'QF'] },
  { id: 'kardex', label: 'Kardex', path: '/api/reportes/kardex', roles: ['ADMIN', 'AUDITOR', 'QF'] },
  { id: 'auditoria', label: 'Auditoría', path: '/api/reportes/auditoria', roles: ['ADMIN', 'AUDITOR'] },
]

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function rol() {
  return getRol()
}

function textoCorto(valor) {
  const texto = valor == null ? '' : String(valor)
  if (!texto) return '—'
  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto
}

export default function Reportes() {
  const usuario = rol()
  const visibles = REPORTES.filter((item) => item.roles.includes(usuario))
  const [reporte, setReporte] = useState(visibles[0]?.id || 'consolidado')
  const [sucursales, setSucursales] = useState([])
  const [sucursalId, setSucursalId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [periodo, setPeriodo] = useState('')
  const [dias, setDias] = useState('90')
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [datos, setDatos] = useState(null)
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const reqId = useRef(0)
  const actual = REPORTES.find((item) => item.id === reporte) || REPORTES[0]
  const permitido = actual.roles.includes(usuario)
  const paginado = reporte === 'kardex' || reporte === 'auditoria'

  const loadSucursales = useCallback(async () => {
    const suc = await api('/api/catalogos/sucursales')
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
  }, [])

  const loadReporte = useCallback(async () => {
    const id = ++reqId.current
    const query = {}
    if (['ventas', 'caja', 'activos', 'kardex'].includes(reporte) && sucursalId) query.sucursalId = sucursalId
    if (['ventas', 'caja', 'kardex', 'auditoria'].includes(reporte)) {
      if (desde) query.desde = desde
      if (hasta) query.hasta = hasta
    }
    if (reporte === 'planilla' && periodo) query.periodo = periodo
    if (reporte === 'inventario') query.dias = dias || 90
    if (paginado) {
      query.limit = limit
      query.offset = offset
      if (qDebounced.trim()) query.q = qDebounced.trim()
    }
    const data = await api(actual.path, { query })
    if (id !== reqId.current) return
    if (paginado) {
      setFilas(Array.isArray(data?.datos) ? data.datos : [])
      setDatos(null)
      setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
    } else {
      setDatos(data?.datos || null)
      setFilas([])
      setTotal(0)
    }
  }, [reporte, sucursalId, desde, hasta, periodo, dias, limit, offset, qDebounced, paginado, actual.path])

  useEffect(() => {
    loadSucursales().catch(() => {})
  }, [loadSucursales])

  useEffect(() => {
    setOffset(0)
  }, [reporte, sucursalId, desde, hasta, periodo, dias, qDebounced, limit])

  useEffect(() => {
    if (!permitido) {
      setLoading(false)
      setError('Tu rol no puede ver este reporte')
      return undefined
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadReporte()
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
  }, [loadReporte, permitido])

  const patrimonio = datos?.resumenPatrimonial
  const desgloseRed = Array.isArray(datos?.desglosePorSucursal) ? datos.desglosePorSucursal : []
  const ventasFilas = Array.isArray(datos?.sucursales) ? datos.sucursales : []
  const lotes = Array.isArray(datos?.lotes) ? datos.lotes : []
  const turnos = Array.isArray(datos?.turnos) ? datos.turnos : []
  const nomina = reporte === 'planilla' && Array.isArray(datos?.desglose) ? datos.desglose : []
  const activos = reporte === 'activos' && Array.isArray(datos?.desglose) ? datos.desglose : []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dirección · Reportes</p>
        <h1 className="font-display text-3xl">Reportes gerenciales</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          El consolidado suma inventario a costo y activos en libros. El tablero del inicio sigue en su propia pantalla.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>{actual.label}</CardTitle>
              <CardDescription>Consulta de solo lectura</CardDescription>
            </div>
            {paginado ? <Buscador value={q} onChange={setQ} placeholder="Buscar en el reporte…" /> : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select className={selectClass} aria-label="Reporte" value={reporte} onChange={(e) => setReporte(e.target.value)}>
              {visibles.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            {['ventas', 'caja', 'activos', 'kardex'].includes(reporte) ? (
              <select className={selectClass} aria-label="Sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                <option value="">Todas las sucursales</option>
                {sucursales.map((s) => (
                  <option key={field(s, 'ID')} value={field(s, 'ID')}>{field(s, 'Nombre')}</option>
                ))}
              </select>
            ) : null}
            {reporte === 'planilla' ? (
              <Input type="month" aria-label="Periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            ) : null}
            {reporte === 'inventario' ? (
              <Input type="number" min="1" aria-label="Días" value={dias} onChange={(e) => setDias(e.target.value)} />
            ) : null}
            {['ventas', 'caja', 'kardex', 'auditoria'].includes(reporte) ? (
              <>
                <Input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
                <Input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <Skeleton className="h-48 rounded-xl" /> : null}
          {!loading && error ? <p className="text-destructive">{error}</p> : null}
          {!loading && !error && reporte === 'consolidado' && patrimonio ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <p className="text-sm">Patrimonio {gtq(patrimonio.valorConsolidadoGTQ)}</p>
                <p className="text-sm">Referencia US$ {Number(patrimonio.valorConsolidadoUSD || 0).toLocaleString('en-US')}</p>
                <p className="text-sm">Nómina {gtq(patrimonio.planillaMensual)} · {patrimonio.ultimoPeriodoPlanilla}</p>
                <p className="text-sm">Inventario a costo {gtq(patrimonio.inventarioCosto)}</p>
                <p className="text-sm">Activos en libros {gtq(patrimonio.activosFijosLibros)}</p>
                <p className="text-sm">Tipo de cambio {patrimonio.tasaCambioReferencia}</p>
              </div>
              <TablaSimple
                headers={['Sucursal', 'Tipo', 'Inventario', 'Activos', 'Total']}
                rows={desgloseRed.map((row) => [
                  row.nombre,
                  row.tipo,
                  gtq(row.inventarioCosto),
                  gtq(row.activosLibros),
                  gtq(row.totalSucursal),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'ventas' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Total de la red {gtq(datos?.totalVentasRed)}</p>
              <TablaSimple
                headers={['Sucursal', 'Tickets', 'Efectivo', 'Tarjeta', 'Transferencia', 'Total']}
                rows={ventasFilas.map((row) => [
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'TOTAL_TRANSACCIONES'),
                  gtq(field(row, 'VENTAS_EFECTIVO')),
                  gtq(field(row, 'VENTAS_TARJETA')),
                  gtq(field(row, 'VENTAS_TRANSFERENCIA')),
                  gtq(field(row, 'TOTAL_VENTAS')),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'inventario' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {datos?.totalLotesProximos ?? 0} lotes en {datos?.filtroDias ?? dias} días · riesgo {gtq(datos?.valorEnRiesgo)}
              </p>
              <TablaSimple
                headers={['Sucursal', 'Medicamento', 'Lote', 'Vence', 'Días', 'Cant.', 'Costo']}
                rows={lotes.map((row) => [
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'MEDICAMENTO_NOMBRE'),
                  field(row, 'LOTE'),
                  field(row, 'FECHA_VENCIMIENTO'),
                  field(row, 'DIAS_RESTANTES'),
                  field(row, 'CANTIDAD'),
                  gtq(field(row, 'VALOR_COSTO')),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'caja' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {datos?.totalTurnosAnalizados ?? 0} turnos · exactos {datos?.metricas?.cuadreExacto ?? 0} · sobrantes {datos?.metricas?.conSobrante ?? 0} · faltantes {datos?.metricas?.conFaltante ?? 0}
              </p>
              <TablaSimple
                headers={['Sucursal', 'Cajero', 'Estado', 'Esperado', 'Contado', 'Diferencia']}
                rows={turnos.map((row) => [
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'CAJERO_NOMBRE'),
                  field(row, 'ESTADO'),
                  gtq(field(row, 'ESPERADO_EN_CAJA')),
                  gtq(field(row, 'MONTO_CONTADO')),
                  gtq(field(row, 'DIFERENCIA')),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'planilla' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Nómina {gtq(datos?.totalNominaRed)} · periodo {datos?.periodo || 'todos'}</p>
              <TablaSimple
                headers={['Periodo', 'Sucursal', 'Empleados', 'IGSS', 'A pagar', 'Pendientes']}
                rows={nomina.map((row) => [
                  field(row, 'PERIODO'),
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'TOTAL_EMPLEADOS'),
                  gtq(field(row, 'TOTAL_IGSS')),
                  gtq(field(row, 'TOTAL_A_PAGAR')),
                  field(row, 'EMPLEADOS_PENDIENTES'),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'activos' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {datos?.totalActivos ?? 0} activos · adquisición {gtq(datos?.totalAdquisicion)} · libros {gtq(datos?.totalValorLibros)}
              </p>
              <TablaSimple
                headers={['Sucursal', 'Categoría', 'Activos', 'Adquisición', 'Depreciación', 'Libros']}
                rows={activos.map((row) => [
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'CATEGORIA'),
                  field(row, 'TOTAL_ACTIVOS'),
                  gtq(field(row, 'TOTAL_ADQUISICION')),
                  gtq(field(row, 'TOTAL_DEPRECIACION')),
                  gtq(field(row, 'VALOR_LIBROS')),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'kardex' ? (
            <TablaSimple
              headers={['Fecha', 'Sucursal', 'Medicamento', 'Tipo', 'Lote', 'Cant.', 'Referencia']}
              rows={filas.map((row) => [
                field(row, 'FECHA'),
                field(row, 'SUCURSAL_NOMBRE'),
                field(row, 'MEDICAMENTO_NOMBRE'),
                field(row, 'TIPO'),
                field(row, 'LOTE'),
                field(row, 'CANTIDAD'),
                field(row, 'REFERENCIA'),
              ])}
            />
          ) : null}
          {!loading && !error && reporte === 'auditoria' ? (
            <TablaSimple
              headers={['Fecha', 'Tabla', 'Acción', 'Usuario', 'Anterior', 'Nuevo']}
              rows={filas.map((row) => [
                field(row, 'FECHA'),
                field(row, 'TABLA'),
                field(row, 'ACCION'),
                field(row, 'USUARIO_NOMBRE') || field(row, 'USUARIO_ORACLE'),
                textoCorto(field(row, 'DATOS_ANTERIORES')),
                textoCorto(field(row, 'DATOS_NUEVOS')),
              ])}
            />
          ) : null}
          {paginado ? (
            <Paginacion
              total={total}
              limit={limit}
              offset={offset}
              onChange={({ limit: nextLimit, offset: nextOffset }) => {
                setLimit(nextLimit)
                setOffset(nextOffset)
              }}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function TablaSimple({ headers, rows }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin filas para ese filtro.</p>
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((cells, index) => (
          <TableRow key={index}>
            {cells.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell ?? '—'}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
