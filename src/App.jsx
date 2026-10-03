import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Sucursales from './pages/Sucursales'
import Roles from './pages/Roles'
import Permisos from './pages/Permisos'
import Inventario from './pages/Inventario'
import Compras from './pages/Compras'
import Proveedores from './pages/Proveedores'
import Ventas from './pages/Ventas'
import Transferencias from './pages/Transferencias'
import Caja from './pages/Caja'
import Activos from './pages/Activos'
import Planilla from './pages/Planilla'
import CallCenter from './pages/CallCenter'
import Pedidos from './pages/Pedidos'
import Reportes from './pages/Reportes'
import { getToken } from './lib/auth'
import { inicioDe, puedeModulo } from './lib/roles'

function RequireAuth() {
  if (!getToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicOnly() {
  if (getToken()) return <Navigate to={inicioDe()} replace />
  return <Outlet />
}

function Guard({ modulo, children }) {
  const location = useLocation()
  if (puedeModulo(modulo)) return children
  const destino = inicioDe()
  if (location.pathname === destino) {
    return <p className="text-destructive">Tu rol no puede entrar a este módulo.</p>
  }
  return <Navigate to={destino} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="top-right" />
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Guard modulo="tablero"><Dashboard /></Guard>} />
            <Route path="sucursales" element={<Guard modulo="sucursales"><Sucursales /></Guard>} />
            <Route path="inventario" element={<Guard modulo="inventario"><Inventario /></Guard>} />
            <Route path="inventario/compras" element={<Guard modulo="compras"><Compras /></Guard>} />
            <Route path="inventario/proveedores" element={<Guard modulo="proveedores"><Proveedores /></Guard>} />
            <Route path="ventas" element={<Guard modulo="ventas"><Ventas /></Guard>} />
            <Route path="transferencias" element={<Guard modulo="transferencias"><Transferencias /></Guard>} />
            <Route path="caja" element={<Guard modulo="caja"><Caja /></Guard>} />
            <Route path="usuarios" element={<Guard modulo="usuarios"><Usuarios /></Guard>} />
            <Route path="usuarios/roles" element={<Guard modulo="roles"><Roles /></Guard>} />
            <Route path="usuarios/permisos" element={<Guard modulo="permisos"><Permisos /></Guard>} />
            <Route path="activos" element={<Guard modulo="activos"><Activos /></Guard>} />
            <Route path="planilla" element={<Guard modulo="planilla"><Planilla /></Guard>} />
            <Route path="call-center" element={<Guard modulo="callCenter"><CallCenter /></Guard>} />
            <Route path="entregas" element={<Guard modulo="entregas"><Pedidos /></Guard>} />
            <Route path="reportes" element={<Guard modulo="reportes"><Reportes /></Guard>} />

          </Route>
        </Route>
        <Route path="*" element={<Navigate to={inicioDe()} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
