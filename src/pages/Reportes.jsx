import { useCallback, useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Buscador from '@/components/Buscador'
import Paginacion from '@/components/Paginacion'
import { api, downloadCsv, gtq } from '@/lib/utils'
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
  { id: 'auditoria', label: 'Auditoría', path: '/api/reportes/auditoria', roles: ['ADMIN', 'AUDITOR', 'QF'] },
]

const TABLAS_AUDITORIA = [
  'F_Medicamentos',
  'F_Proveedores',
  'F_Inventario',
  'F_Ventas',
  'F_Usuarios',
  'F_Empleados',
  'F_Sucursal',
  'F_Turno_caja',
]
const ACCIONES_AUDITORIA = ['INSERT', 'UPDATE', 'DELETE']
const ESTADOS_TURNO = ['ABIERTA', 'CERRADA', 'AUDITADA']
const CATEGORIAS_ACTIVO = ['MOBILIARIO', 'EQUIPO', 'VEHICULO', 'INMUEBLE', 'TECNOLOGIA']
const TIPOS_KARDEX = ['ENTRADA', 'VENTA', 'SALIDA', 'AJUSTE', 'ANULACION']
const CON_SUCURSAL = ['ventas', 'inventario', 'caja', 'planilla', 'activos', 'kardex']
const CON_FECHAS = ['ventas', 'caja', 'kardex', 'auditoria']

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

const TOPE_CSV = 2000
const PAGINA_CSV = 100

function hoyIso() {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

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
  const [tabla, setTabla] = useState('')
  const [accion, setAccion] = useState('')
  const [estadoTurno, setEstadoTurno] = useState('')
  const [categoria, setCategoria] = useState('')
  const [tipoMov, setTipoMov] = useState('')
  const [medicamentoId, setMedicamentoId] = useState('')
  const [medicamentos, setMedicamentos] = useState([])
  const [extra, setExtra] = useState(null)
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [datos, setDatos] = useState(null)
  const [filas, setFilas] = useState([])
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState(null)
  const reqId = useRef(0)
  const actual = REPORTES.find((item) => item.id === reporte) || REPORTES[0]
  const permitido = actual.roles.includes(usuario)
  const paginado = reporte === 'kardex' || reporte === 'auditoria' || reporte === 'inventario'

  const loadSucursales = useCallback(async () => {
    const [suc, meds] = await Promise.all([
      api('/api/catalogos/sucursales'),
      api('/api/catalogos/medicamentos'),
    ])
    setSucursales(Array.isArray(suc?.datos) ? suc.datos : [])
    setMedicamentos(Array.isArray(meds?.datos) ? meds.datos : [])
  }, [])

  function armarQuery({ paginar, lim, off }) {
    const query = {}
    if (CON_SUCURSAL.includes(reporte) && sucursalId) query.sucursalId = sucursalId
    if (CON_FECHAS.includes(reporte)) {
      if (desde) query.desde = desde
      if (hasta) query.hasta = hasta
    }
    if (reporte === 'planilla' && periodo) query.periodo = periodo
    if (reporte === 'inventario') query.dias = dias || 90
    if (reporte === 'caja' && estadoTurno) query.estado = estadoTurno
    if (reporte === 'activos' && categoria) query.categoria = categoria
    if (reporte === 'kardex') {
      if (tipoMov) query.tipo = tipoMov
      if (medicamentoId) query.medicamentoId = medicamentoId
    }
    if (reporte === 'auditoria') {
      if (tabla) query.tabla = tabla
      if (accion) query.accion = accion
    }
    if (paginar) {
      query.limit = lim
      query.offset = off
      if (qDebounced.trim()) query.q = qDebounced.trim()
    }
    return query
  }

  const loadReporte = useCallback(async () => {
    const id = ++reqId.current
    const query = armarQuery({ paginar: paginado, lim: limit, off: offset })
    const data = await api(actual.path, { query })
    if (id !== reqId.current) return
    if (paginado) {
      setFilas(Array.isArray(data?.datos) ? data.datos : [])
      setDatos(null)
      setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
      setExtra(reporte === 'inventario'
        ? { filtroDias: data?.filtroDias, valorEnRiesgo: data?.valorEnRiesgo }
        : null)
    } else {
      setDatos(data?.datos || null)
      setFilas([])
      setTotal(0)
      setExtra(null)
    }
  }, [reporte, sucursalId, desde, hasta, periodo, dias, tabla, accion, estadoTurno, categoria, tipoMov, medicamentoId, limit, offset, qDebounced, paginado, actual.path])

  useEffect(() => {
    loadSucursales().catch(() => {})
  }, [loadSucursales])

  useEffect(() => {
    setOffset(0)
  }, [reporte, sucursalId, desde, hasta, periodo, dias, tabla, accion, estadoTurno, categoria, tipoMov, medicamentoId, qDebounced, limit])

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
  const turnos = Array.isArray(datos?.turnos) ? datos.turnos : []
  const nomina = reporte === 'planilla' && Array.isArray(datos?.desglose) ? datos.desglose : []
  const activos = reporte === 'activos' && Array.isArray(datos?.desglose) ? datos.desglose : []

  function columnasCsv() {
    if (reporte === 'consolidado') {
      return [
        { label: 'Sucursal', value: (row) => row.nombre },
        { label: 'Tipo', value: (row) => row.tipo },
        { label: 'Inventario', value: (row) => row.inventarioCosto },
        { label: 'Activos', value: (row) => row.activosLibros },
        { label: 'Total', value: (row) => row.totalSucursal },
      ]
    }
    if (reporte === 'ventas') {
      return [
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Tickets', value: (row) => field(row, 'TOTAL_TRANSACCIONES') },
        { label: 'Efectivo', value: (row) => field(row, 'VENTAS_EFECTIVO') },
        { label: 'Tarjeta', value: (row) => field(row, 'VENTAS_TARJETA') },
        { label: 'Transferencia', value: (row) => field(row, 'VENTAS_TRANSFERENCIA') },
        { label: 'Vuelto', value: (row) => field(row, 'VUELTO') },
        { label: 'Total', value: (row) => field(row, 'TOTAL_VENTAS') },
      ]
    }
    if (reporte === 'inventario') {
      return [
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Medicamento', value: (row) => field(row, 'MEDICAMENTO_NOMBRE') },
        { label: 'Lote', value: (row) => field(row, 'LOTE') },
        { label: 'Vence', value: (row) => field(row, 'FECHA_VENCIMIENTO') },
        { label: 'Días', value: (row) => field(row, 'DIAS_RESTANTES') },
        { label: 'Cant.', value: (row) => field(row, 'CANTIDAD') },
        { label: 'Costo', value: (row) => field(row, 'VALOR_COSTO') },
      ]
    }
    if (reporte === 'caja') {
      return [
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Cajero', value: (row) => field(row, 'CAJERO_NOMBRE') },
        { label: 'Estado', value: (row) => field(row, 'ESTADO') },
        { label: 'Esperado', value: (row) => field(row, 'ESPERADO_EN_CAJA') },
        { label: 'Contado', value: (row) => field(row, 'MONTO_CONTADO') },
        { label: 'Diferencia', value: (row) => field(row, 'DIFERENCIA') },
      ]
    }
    if (reporte === 'planilla') {
      return [
        { label: 'Periodo', value: (row) => field(row, 'PERIODO') },
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Empleados', value: (row) => field(row, 'TOTAL_EMPLEADOS') },
        { label: 'IGSS', value: (row) => field(row, 'TOTAL_IGSS') },
        { label: 'A pagar', value: (row) => field(row, 'TOTAL_A_PAGAR') },
        { label: 'Pendientes', value: (row) => field(row, 'EMPLEADOS_PENDIENTES') },
      ]
    }
    if (reporte === 'activos') {
      return [
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Categoría', value: (row) => field(row, 'CATEGORIA') },
        { label: 'Activos', value: (row) => field(row, 'TOTAL_ACTIVOS') },
        { label: 'Adquisición', value: (row) => field(row, 'TOTAL_ADQUISICION') },
        { label: 'Depreciación', value: (row) => field(row, 'TOTAL_DEPRECIACION') },
        { label: 'Libros', value: (row) => field(row, 'VALOR_LIBROS') },
      ]
    }
    if (reporte === 'kardex') {
      return [
        { label: 'Fecha', value: (row) => field(row, 'FECHA') },
        { label: 'Sucursal', value: (row) => field(row, 'SUCURSAL_NOMBRE') },
        { label: 'Medicamento', value: (row) => field(row, 'MEDICAMENTO_NOMBRE') },
        { label: 'Tipo', value: (row) => field(row, 'TIPO') },
        { label: 'Lote', value: (row) => field(row, 'LOTE') },
        { label: 'Cant.', value: (row) => field(row, 'CANTIDAD') },
        { label: 'Referencia', value: (row) => field(row, 'REFERENCIA') },
      ]
    }
    return [
      { label: 'Fecha', value: (row) => field(row, 'FECHA') },
      { label: 'Tabla', value: (row) => field(row, 'TABLA') },
      { label: 'Acción', value: (row) => field(row, 'ACCION') },
      { label: 'Usuario', value: (row) => field(row, 'USUARIO_NOMBRE') || field(row, 'USUARIO_ORACLE') },
      { label: 'Anterior', value: (row) => field(row, 'DATOS_ANTERIORES') },
      { label: 'Nuevo', value: (row) => field(row, 'DATOS_NUEVOS') },
    ]
  }

  function filasEnMemoria() {
    if (reporte === 'consolidado') return desgloseRed
    if (reporte === 'ventas') return ventasFilas
    if (reporte === 'inventario') return filas
    if (reporte === 'caja') return turnos
    if (reporte === 'planilla') return nomina
    if (reporte === 'activos') return activos
    return filas
  }

  function queryFiltro({ limit: lim, offset: off, paginar }) {
    return armarQuery({ paginar, lim, off })
  }

  async function juntarPaginas() {
    const rows = []
    let offsetPag = 0
    let totalApi = Infinity
    while (rows.length < TOPE_CSV && offsetPag < totalApi) {
      const data = await api(actual.path, {
        query: queryFiltro({ limit: PAGINA_CSV, offset: offsetPag, paginar: true }),
      })
      const lote = Array.isArray(data?.datos) ? data.datos : []
      totalApi = Number(data?.paginacion?.total ?? data?.total ?? rows.length + lote.length)
      rows.push(...lote)
      if (lote.length < PAGINA_CSV) break
      offsetPag += PAGINA_CSV
    }
    return { rows: rows.slice(0, TOPE_CSV), tope: totalApi > TOPE_CSV }
  }

  async function handleExportar() {
    if (!permitido || exportando) return
    setExportando(true)
    try {
      const juntadas = paginado ? await juntarPaginas() : { rows: filasEnMemoria(), tope: false }
      if (!juntadas.rows.length) {
        toast.error('No hay filas para exportar')
        return
      }
      downloadCsv(`farmared-${reporte}-${hoyIso()}.csv`, juntadas.rows, columnasCsv())
      if (juntadas.tope) toast.success('Se exportaron las primeras 2000 filas')
    } catch (err) {
      toast.error(err.message || 'No se pudo exportar el reporte')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Direccion · Reportes</p>
          <h1 className="font-display text-3xl">Reportes gerenciales</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            El consolidado suma inventario a costo y activos en libros y el tablero del inicio sigue en su propia pantalla
          </p>
        </div>
        {permitido ? (
          <Button type="button" variant="outline" className="gap-2" onClick={handleExportar} disabled={exportando || loading}>
            <Download className="h-4 w-4" />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        ) : null}
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
            {CON_SUCURSAL.includes(reporte) ? (
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
            {CON_FECHAS.includes(reporte) ? (
              <>
                <Input type="date" aria-label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
                <Input type="date" aria-label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
              </>
            ) : null}
            {reporte === 'caja' ? (
              <select className={selectClass} aria-label="Estado del turno" value={estadoTurno} onChange={(e) => setEstadoTurno(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS_TURNO.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            ) : null}
            {reporte === 'activos' ? (
              <select className={selectClass} aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                <option value="">Todas las categorias</option>
                {CATEGORIAS_ACTIVO.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            ) : null}
            {reporte === 'kardex' ? (
              <>
                <select className={selectClass} aria-label="Tipo de movimiento" value={tipoMov} onChange={(e) => setTipoMov(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  {TIPOS_KARDEX.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select className={selectClass} aria-label="Medicamento" value={medicamentoId} onChange={(e) => setMedicamentoId(e.target.value)}>
                  <option value="">Todos los medicamentos</option>
                  {medicamentos.map((med) => (
                    <option key={field(med, 'ID')} value={field(med, 'ID')}>
                      {field(med, 'NOMBRE_MEDICAMENTO')}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {reporte === 'auditoria' ? (
              <>
                <select className={selectClass} aria-label="Tabla" value={tabla} onChange={(e) => setTabla(e.target.value)}>
                  <option value="">Todas las tablas</option>
                  {TABLAS_AUDITORIA.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
                <select className={selectClass} aria-label="Accion" value={accion} onChange={(e) => setAccion(e.target.value)}>
                  <option value="">Todas las acciones</option>
                  {ACCIONES_AUDITORIA.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
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
                <p className="text-sm">Nomina {gtq(patrimonio.planillaMensual)} · {patrimonio.ultimoPeriodoPlanilla}</p>
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
                headers={['Sucursal', 'Tickets', 'Efectivo', 'Tarjeta', 'Transferencia', 'Vuelto', 'Total']}
                rows={ventasFilas.map((row) => [
                  field(row, 'SUCURSAL_NOMBRE'),
                  field(row, 'TOTAL_TRANSACCIONES'),
                  gtq(field(row, 'VENTAS_EFECTIVO')),
                  gtq(field(row, 'VENTAS_TARJETA')),
                  gtq(field(row, 'VENTAS_TRANSFERENCIA')),
                  gtq(field(row, 'VUELTO')),
                  gtq(field(row, 'TOTAL_VENTAS')),
                ])}
              />
            </div>
          ) : null}
          {!loading && !error && reporte === 'inventario' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {total} lotes en {extra?.filtroDias ?? dias} días · riesgo {gtq(extra?.valorEnRiesgo)}
              </p>
              <TablaSimple
                headers={['Sucursal', 'Medicamento', 'Lote', 'Vence', 'Dias', 'Cant.', 'Costo']}
                rows={filas.map((row) => [
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
                  field(row, 'MONTO_CONTADO') == null ? '—' : gtq(field(row, 'MONTO_CONTADO')),
                  field(row, 'DIFERENCIA') == null ? '—' : gtq(field(row, 'DIFERENCIA')),
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
                headers={['Sucursal', 'Categoria', 'Activos', 'Adquisicion', 'Depreciacion', 'Libros']}
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
