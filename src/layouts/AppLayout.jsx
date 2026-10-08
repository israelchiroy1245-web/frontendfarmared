import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Ambulance,
  Building2,
  ClipboardList,
  FileBarChart,
  Headset,
  Landmark,
  Receipt,
  LayoutDashboard,
  Menu,
  Package,
  Truck,
  Users,
  Wallet,
  LogOut,
  Shield,
  ChevronDown,
  KeyRound,
  ShoppingCart,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getUser, logout } from '@/lib/auth'
import { getRol, puedeModulo } from '@/lib/roles'

const HOVER_OPEN_MS = 3000

const links = [
  { to: '/', label: 'Tablero', icon: LayoutDashboard, modulo: 'tablero' },
  { to: '/sucursales', label: 'Sucursales', icon: Building2, modulo: 'sucursales' },
  {
    to: '/inventario',
    label: 'Inventario',
    icon: Package,
    modulo: 'inventario',
    children: [
      { to: '/inventario/compras', label: 'Compras', icon: ShoppingCart, modulo: 'compras' },
      { to: '/inventario/proveedores', label: 'Proveedores', icon: Truck, modulo: 'proveedores' },
    ],
  },
  //{ to: '/ventas', label: 'Ventas', icon: Receipt, modulo: 'ventas' },
  { to: '/transferencias', label: 'Transferencias', icon: Truck, modulo: 'transferencias' },
  { to: '/caja', label: 'Flujo de caja', icon: Wallet, modulo: 'caja',
    children: [
      { to: '/ventas', label: 'Ventas', icon: Receipt, modulo: 'ventas' },
    ]
  },

  { to: '/activos', label: 'Activos fijos', icon: Landmark, modulo: 'activos' },
  { to: '/planilla', label: 'Planilla', icon: Users, modulo: 'planilla' },
  { to: '/entregas', label: 'Entregas', icon: Ambulance, modulo: 'entregas' },
  { to: '/call-center', label: 'Call center', icon: Headset, modulo: 'callCenter' },
  { to: '/reportes', label: 'Reportes', icon: FileBarChart, modulo: 'reportes' },
  {
    to: '/usuarios',
    label: 'Usuarios',
    icon: Users,
    modulo: 'usuarios',
    children: [
      { to: '/usuarios/roles', label: 'Roles', icon: Shield, modulo: 'roles' },
      { to: '/usuarios/permisos', label: 'Permisos', icon: KeyRound, modulo: 'permisos' },
    ],
  },
    
]

function linksDelRol(rol) {
  return links.flatMap((item) => {
    if (!puedeModulo(item.modulo, rol)) return []
    if (!item.children) return [item]
    const children = item.children.filter((child) => puedeModulo(child.modulo, rol))
    return [{ ...item, children }]
  })
}

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
  }`

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

function NavGroup({ item, onClick }) {
  const Icon = item.icon
  const location = useLocation()
  const sectionActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  const [open, setOpen] = useState(sectionActive)
  const timerRef = useRef(null)

  useEffect(() => {
    if (sectionActive) setOpen(true)
  }, [sectionActive])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handleMouseEnter() {
    clearTimer()
    timerRef.current = setTimeout(() => setOpen(true), HOVER_OPEN_MS)
  }

  function handleMouseLeave() {
    clearTimer()
    if (!sectionActive) setOpen(false)
  }

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className="flex items-center gap-1">
        <NavLink
          to={item.to}
          end
          onClick={onClick}
          className={({ isActive }) => `${linkClass({ isActive: isActive || sectionActive })} flex-1`}
        >
          <Icon className="h-4 w-4" />
          {item.label}
        </NavLink>
        <button
          type="button"
          aria-label={`Mostrar submenú de ${item.label}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open ? (
        <div className="mt-1 ml-4 flex flex-col gap-1 border-l border-sidebar-border pl-2">
          {item.children.map((child) => {
            const ChildIcon = child.icon
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onClick}
                className={linkClass}
              >
                <ChildIcon className="h-4 w-4" />
                {child.label}
              </NavLink>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function NavItems({ onClick, onLogout }) {
  const visibles = linksDelRol(getRol())

  return (
    <nav className="mt-8 flex flex-col gap-1">
      {visibles.map((l) => {
        if (l.children?.length) {
          return <NavGroup key={l.to} item={l} onClick={onClick} />
        }

        const Icon = l.icon
        return (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            onClick={onClick}
            className={linkClass}
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
  const [sidebar, setSidebar] = useState(true)
  const [escritorio, setEscritorio] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const navigate = useNavigate()
  const rol = getRol()
  const sesion = getUser()
  const nombre = [sesion?.nombre || sesion?.NOMBRE, sesion?.apellido || sesion?.APELLIDO]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const sync = () => setEscritorio(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  async function handleLogout() {
    await logout()
    setOpen(false)
    toast.success('Sesión cerrada')
    navigate('/login', { replace: true })
  }

  function toggleMenu() {
    if (escritorio) {
      setSidebar((visible) => !visible)
      return
    }
    setOpen(true)
  }

  return (
    <div className="flex min-h-full">
      <aside className={`${sidebar ? 'md:block' : 'md:hidden'} hidden w-64 shrink-0 bg-sidebar p-5`}>
        <Brand />
        <NavItems onLogout={handleLogout} />
      </aside>
     {/* Header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card/80 px-4 py-3 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <Button
                variant="outline"
                size="icon"
                aria-label={escritorio ? (sidebar ? 'Ocultar menú' : 'Mostrar menú') : 'Abrir menú'}
                aria-expanded={escritorio ? sidebar : open}
                onClick={toggleMenu}
              >
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
            {rol ? (
              <Badge variant="secondary">
                <User className="h-3 w-3" />
                {nombre ? `${nombre} · ${rol}` : rol}
              </Badge>
            ) : null}
            {/*<Badge variant="gold">Examen privado</Badge>
            <Badge variant="ok" className="hidden sm:inline-flex">
              <ClipboardList className="mr-1 h-3 w-3" />
              Auditoría en vivo
            </Badge> */}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
