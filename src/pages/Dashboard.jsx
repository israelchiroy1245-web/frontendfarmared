import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Landmark, Package, Store, Users, Wallet } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, gtq } from '@/lib/utils'

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

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/dashboard').then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) {
    return <p className="text-destructive">No se pudo cargar el tablero: {error}</p>
  }
  if (!data) {
    return <p className="text-muted-foreground">Cargando indicadores de la red…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Tablero ejecutivo</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Vista consolidada de inventario, efectivo, planilla, activos fijos y entregas a domicilio en las 12 sucursales de la red.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={Store} label="Sucursales activas" value={data.sucursales_activas} hint="Mall, tradicionales y stands en gasolinera" />
        <Kpi icon={Package} label="Inventario a costo" value={gtq(data.inventario.valor_costo)} hint={`Valor de venta ${gtq(data.inventario.valor_venta)}`} />
        <Kpi icon={Wallet} label="Ventas registradas" value={gtq(data.caja.ventas)} hint={`${data.caja.turnos_abiertos} turnos abiertos ahora`} />
        <Kpi icon={Users} label="Planilla del periodo" value={gtq(data.planilla.total)} hint={`Periodo ${data.planilla.periodo}`} />
        <Kpi icon={Landmark} label="Activos en libros" value={gtq(data.activos.libros)} hint={`Adquisición ${gtq(data.activos.adquisicion)}`} />
        <Kpi
          icon={ArrowRightLeft}
          label="Logística en curso"
          value={`${data.entregas.pendientes} entregas`}
          hint={`${data.transferencias.transito} transferencias en tránsito`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ventas por sucursal</CardTitle>
            <CardDescription>Efectivo + tarjeta acumulado en turnos de caja</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ventas_por_sucursal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ddd4c4" />
                <XAxis dataKey="codigo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => gtq(v)} />
                <Bar dataKey="ventas" fill="#0f6b5c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-accent" />
              Stock bajo
            </CardTitle>
            <CardDescription>Productos en o debajo del mínimo</CardDescription>
          </CardHeader>
          <CardContent>
            {data.alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas de inventario.</p>
            ) : (
              <ul className="space-y-3">
                {data.alertas.slice(0, 7).map((a) => (
                  <li key={`${a.sucursal_id}-${a.sku}`} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{a.producto}</p>
                      <p className="text-xs text-muted-foreground">{a.sucursal}</p>
                    </div>
                    <Badge variant={a.cantidad === 0 ? 'danger' : 'warn'}>
                      {a.cantidad}/{a.stock_minimo}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flujo de efectivo resumido</CardTitle>
          <CardDescription>Para auditoría inmediata de toda la empresa</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Concepto</TableHead>
                <TableHead>Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Ventas en efectivo</TableCell>
                <TableCell>{gtq(data.caja.efectivo)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Ventas con tarjeta</TableCell>
                <TableCell>{gtq(data.caja.tarjeta)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Gastos de caja chica</TableCell>
                <TableCell>{gtq(data.caja.gastos)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Entregas pendientes / cumplidas</TableCell>
                <TableCell>
                  {data.entregas.pendientes} / {data.entregas.entregados}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}