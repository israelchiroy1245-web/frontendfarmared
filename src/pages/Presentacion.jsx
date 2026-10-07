import { Link } from 'react-router-dom'
import {
  Ambulance,
  ArrowRightLeft,
  Headset,
  Landmark,
  Package,
  Receipt,
  Shield,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const modulos = [
  { icon: Store, titulo: 'Sucursales', texto: 'Mall, farmacia tradicional y stand en gasolinera. Cada local opera su propio stock y su propio turno.' },
  { icon: Package, titulo: 'Inventario', texto: 'Lotes con vencimiento. Al cobrar, Oracle descuenta el que vence primero (FEFO). El lote no tiene precio.' },
  { icon: Receipt, titulo: 'Compras', texto: 'La factura del proveedor entra al inventario por línea. Queda registrada y no se edita.' },
  { icon: Wallet, titulo: 'Caja y POS', texto: 'Abrir turno, cobrar tickets y cerrar con el conteo físico. Sin turno abierto no hay venta.' },
  { icon: ArrowRightLeft, titulo: 'Transferencias', texto: 'El químico farmacéutico mueve mercancía entre sucursales. El cajero no traslada.' },
  { icon: Users, titulo: 'Planilla', texto: 'Salario, bonificación e IGSS laboral. El auditor consulta; el administrador genera y paga.' },
  { icon: Landmark, titulo: 'Activos fijos', texto: 'Mobiliario y equipo con depreciación. El valor en libros es adquisición menos lo depreciado.' },
  { icon: Headset, titulo: 'Call center', texto: 'Consulta cobertura por distancia y deja el pedido. El canal del portal queda reservado, no hay tienda pública.' },
  { icon: Ambulance, titulo: 'Entregas', texto: 'El pedido avanza de confirmado a entregado. Un estado final ya no se cambia.' },
  { icon: Shield, titulo: 'Personas y auditoría', texto: 'Una persona es un usuario y un empleado. La baja es inactivar, no borrar. El auditor revisa caja y reportes.' },
]

const roles = [
  { rol: 'ADMIN', entra: 'Tablero de toda la red' },
  { rol: 'CAJERO', entra: 'Su sucursal: caja y punto de venta' },
  { rol: 'QF', entra: 'Inventario, compras y traslados' },
  { rol: 'AUDITOR', entra: 'Caja, planilla y reportes, sin cobrar' },
  { rol: 'CALL CENTER', entra: 'Consulta de cobertura y pedidos' },
]

export const Presentacion = () => {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">Examen privado</Badge>
            <Badge className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">Guatemala</Badge>
          </div>
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.16em] text-sidebar-foreground/60">FarmaRed</p>
            <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Control operativo de una red de farmacias</h1>
            <p className="mt-4 text-base text-sidebar-foreground/75">
              No es una tienda en línea. Es el sistema con el que la red abre caja, vende, cuida el lote que vence, traslada, paga planilla y deja evidencia para el auditor.
            </p>
          </div>
          <Link to="/login" className={buttonVariants({ variant: 'secondary' })}>
            Volver al acceso
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Día de sucursal</CardDescription>
              <CardTitle>Abrir, cobrar, cerrar</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              El cajero abre el turno con un fondo. Cada ticket entra a esa caja. Al cerrar, el esperado es fondo más efectivo menos gastos. El auditor marca el cierre.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Precio</CardDescription>
              <CardTitle>IVA ya incluido</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              El anaquel usa el precio de venta del medicamento. El 12 % se separa del total al cobrar. El pago puede ser efectivo, tarjeta o mixto, y vive aparte de la cabecera del ticket.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Stock</CardDescription>
              <CardTitle>Vence primero, sale primero</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              El mostrador no elige el lote. La base descuenta el vigente que vence antes. Un lote con existencia o con ventas no se borra: se deja en cero.
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="font-display text-2xl">Qué cubre el sistema</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada bloque es una pantalla del menú. El rol decide quién entra; la base sigue siendo quien rechaza una operación indebida.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {modulos.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.titulo} className="flex gap-3 rounded-xl border bg-card p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{item.titulo}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.texto}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-2xl">Quién entra a dónde</h2>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Primera pantalla</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((fila) => (
                  <tr key={fila.rol} className="border-t">
                    <td className="px-4 py-3 font-medium">{fila.rol}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fila.entra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-display text-2xl">Cómo está armado</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            La pantalla es React. La API es Express y habla con Oracle mediante procedimientos: folio, venta, anulación, compra y traslado. La sesión identifica a la persona; caja y ventas buscan a su empleado activo. Si ese empleado no existe, la operación no pasa.
          </p>
        </section>
      </main>
    </div>
  )
}
