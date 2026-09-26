import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Activity,
  Ambulance,
  Building2,
  ClipboardList,
  FileBarChart,
  Headset,
  Landmark,
  LayoutDashboard,
  Menu,
  Package,
  Truck,
  Users,
  Wallet,
  LogOut,
  Settings,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { logout } from '@/lib/auth'

const links = [
  { to: '/', label: 'Tablero', icon: LayoutDashboard },
  { to: '/sucursales', label: 'Sucursales', icon: Building2 },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/transferencias', label: 'Transferencias', icon: Truck },
  { to: '/caja', label: 'Flujo de caja', icon: Wallet },
  { to: '/activos', label: 'Activos fijos', icon: Landmark },
  { to: '/planilla', label: 'Planilla', icon: Users },
  { to: '/entregas', label: 'Entregas', icon: Ambulance },
  { to: '/call-center', label: 'Call center', icon: Headset },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

function Brand() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Activity className="h-5 w-5" />
      </div>
      <div>
        <p className="font-display text-lg leading-none text-sidebar-foreground">FarmaRed</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Red nacional</p>
      </div>
    </div>
  )
}

function NavItems({ onClick, onLogout }) {
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {links.map((l) => {
        const Icon = l.icon
        return (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            onClick={onClick}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {l.label}
          </NavLink>
        )
      })}

      <button
        type="button"
        onClick={onLogout}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </button>
    </nav>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    setOpen(false)
    toast.success('Sesión cerrada')
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-64 shrink-0 bg-sidebar p-5 md:block">
        <Brand />
        <NavItems onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <Button variant="outline" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
              <SheetContent className="bg-sidebar text-sidebar-foreground border-sidebar-border">
                <Brand />
                <NavItems onClick={() => setOpen(false)} onLogout={handleLogout} />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Grupo FarmaRed · Guatemala</p>
              <p className="font-display text-xl leading-tight">Control operativo de la red</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gold">Examen privado</Badge>
            <Badge variant="ok" className="hidden sm:inline-flex">
              <ClipboardList className="mr-1 h-3 w-3" />
              Auditoría en vivo
            </Badge>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
