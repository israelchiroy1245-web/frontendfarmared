import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
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
import { getToken } from './lib/auth'

function RequireAuth() {
  if (!getToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicOnly() {
  if (getToken()) return <Navigate to="/" replace />
  return <Outlet />
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
            <Route index element={<Dashboard />} />
            <Route path="sucursales" element={<Sucursales />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="inventario/compras" element={<Compras />} />
            <Route path="inventario/proveedores" element={<Proveedores />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="transferencias" element={<Transferencias />} />
            <Route path="caja" element={<Caja />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="usuarios/roles" element={<Roles />} />
            <Route path="usuarios/permisos" element={<Permisos />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
