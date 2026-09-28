import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Pencil, Plus, Trash2, Truck } from 'lucide-react'
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
import { getUser } from '@/lib/auth'
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

function puedeMantener() {
  const rol = String(getUser()?.rol || '').toUpperCase()
  return rol === 'ADMIN' || rol === 'QF'
}

const emptyForm = { nombre: '', nit: '', telefono: '', direccion: '', email: '' }

function formFromProveedor(row) {
  return {
    nombre: field(row, 'NOMBRE') || '',
    nit: field(row, 'NIT') || '',
    telefono: field(row, 'TELEFONO') || '',
    direccion: field(row, 'DIRECCION') || '',
    email: field(row, 'EMAIL') || '',
  }
}

export default function Proveedores() {
  const mantener = puedeMantener()
  const [proveedores, setProveedores] = useState([])
  const [q, setQ] = useState('')
  const qDebounced = useDebounced(q)
  const [limit, setLimit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const reqId = useRef(0)

  const loadProveedores = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/proveedores', { query })
    if (id !== reqId.current) return
    setProveedores(Array.isArray(data?.datos) ? data.datos : [])
    setTotal(Number(data?.paginacion?.total ?? data?.total ?? 0))
  }, [limit, offset, qDebounced])

  useEffect(() => {
    setOffset(0)
  }, [qDebounced, limit])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        await loadProveedores()
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
  }, [loadProveedores])

  function setCampo(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function abrirAlta() {
    setFormMode('create')
    setEditId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function abrirEdicion(row) {
    setFormMode('edit')
    setEditId(field(row, 'ID'))
    setForm(formFromProveedor(row))
    setFormOpen(true)
  }

  function validar() {
    if (!form.nombre.trim() || !form.nit.trim()) {
      toast.error('Nombre y NIT son obligatorios')
      return false
    }
    const correo = form.email.trim()
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      toast.error('El correo no tiene un formato válido')
      return false
    }
    return true
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validar()) return
    const body = {
      nombre: form.nombre.trim(),
      nit: form.nit.trim(),
      telefono: form.telefono.trim(),
      direccion: form.direccion.trim(),
      email: form.email.trim(),
    }
    setSaving(true)
    try {
      if (formMode === 'create') {
        await api('/api/proveedores', { method: 'POST', body })
        toast.success('Proveedor registrado')
      } else {
        await api(`/api/proveedores/${editId}`, { method: 'PUT', body })
        toast.success('Proveedor actualizado')
      }
      setFormOpen(false)
      await loadProveedores()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/proveedores/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el proveedor')
      setDetailOpen(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/proveedores/${id}`, { method: 'DELETE' })
      toast.success('Proveedor eliminado')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadProveedores()
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  if (loading && proveedores.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && proveedores.length === 0) {
    return <p className="text-destructive">No se pudieron cargar los proveedores: {error}</p>
  }

  const comprasRecientes = detail?.COMPRAS_RECIENTES || detail?.compras_recientes || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Operación · Proveedores</p>
          <h1 className="font-display text-3xl">Proveedores</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Catálogo de distribuidores y laboratorios. Un proveedor con facturas de compra no se puede eliminar.
          </p>
        </div>
        {mantener ? (
          <Button className="gap-2" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardDescription>Proveedores</CardDescription>
          <div className="rounded-md bg-secondary p-2 text-primary">
            <Truck className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="font-display text-2xl font-semibold">{total}</p>
          <p className="mt-1 text-xs text-muted-foreground">Total con el filtro actual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Catálogo</CardTitle>
            <CardDescription>{total} registros</CardDescription>
          </div>
          <Buscador value={q} onChange={setQ} placeholder="Buscar nombre, NIT o correo…" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {proveedores.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay proveedores con ese filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>NIT</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Facturas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proveedores.map((row) => {
                  const id = field(row, 'ID')
                  const facturas = Number(field(row, 'TOTAL_COMPRAS') ?? 0)
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'NIT') || '—'}</TableCell>
                      <TableCell>{field(row, 'TELEFONO') || '—'}</TableCell>
                      <TableCell>{field(row, 'EMAIL') || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{facturas}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" title="Detalle" onClick={() => openDetail(id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {mantener ? (
                            <Button type="button" variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEdicion(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {mantener ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title={facturas > 0 ? 'Tiene facturas; no se puede eliminar' : 'Eliminar'}
                              disabled={facturas > 0}
                              onClick={() => {
                                setDeleteTarget(row)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Nuevo proveedor' : 'Editar proveedor'}</DialogTitle>
            <DialogDescription>El NIT es único. Nombre y NIT son obligatorios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nombreProveedor">Nombre</Label>
              <Input id="nombreProveedor" value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nitProveedor">NIT</Label>
              <Input id="nitProveedor" value={form.nit} onChange={(e) => setCampo('nit', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telProveedor">Teléfono</Label>
              <Input id="telProveedor" value={form.telefono} onChange={(e) => setCampo('telefono', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emailProveedor">Correo</Label>
              <Input id="emailProveedor" type="email" value={form.email} onChange={(e) => setCampo('email', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dirProveedor">Dirección</Label>
              <Input id="dirProveedor" value={form.direccion} onChange={(e) => setCampo('direccion', e.target.value)} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{field(detail, 'NOMBRE') || 'Proveedor'}</DialogTitle>
            <DialogDescription>NIT {field(detail, 'NIT') || '—'}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {field(detail, 'TELEFONO') || 'Sin teléfono'} · {field(detail, 'EMAIL') || 'Sin correo'}
              </p>
              <p className="text-sm">{field(detail, 'DIRECCION') || 'Sin dirección'}</p>
              <p className="text-sm text-muted-foreground">{field(detail, 'TOTAL_COMPRAS') ?? 0} facturas en total</p>
              {comprasRecientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin compras recientes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comprasRecientes.map((compra) => (
                      <TableRow key={field(compra, 'ID')}>
                        <TableCell>{field(compra, 'NUMERO_FACTURA') || '—'}</TableCell>
                        <TableCell>{field(compra, 'FECHA_COMPRA') || '—'}</TableCell>
                        <TableCell>{field(compra, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                        <TableCell>{gtq(field(compra, 'TOTAL_COMPRA'))}</TableCell>
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar proveedor</DialogTitle>
            <DialogDescription>Solo se elimina si no tiene facturas de compra.</DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Eliminar <span className="font-medium">{field(deleteTarget, 'NOMBRE')}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
