import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Package, Pencil, Plus, Trash2 } from 'lucide-react'
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

function puedeMantener() {
  const rol = getRol()
  return rol === 'ADMIN' || rol === 'QF'
}

const emptyForm = {
  nombre: '',
  codigoBarra: '',
  principioActivo: '',
  presentacion: '',
  laboratorio: '',
  receta: false,
  precioVenta: '',
  costo: '',
  descripcion: '',
}

function formFromMedicamento(row) {
  return {
    nombre: field(row, 'NOMBRE') || '',
    codigoBarra: field(row, 'CODIGO_BARRA') || '',
    principioActivo: field(row, 'PRINCIPIO_ACTIVO') || '',
    presentacion: field(row, 'PRESENTACION') || '',
    laboratorio: field(row, 'LABORATORIO') || '',
    receta: Number(field(row, 'RECETA_REQUERIDA')) === 1,
    precioVenta: field(row, 'PRECIO_VENTA') != null ? String(field(row, 'PRECIO_VENTA')) : '',
    costo: field(row, 'COSTO') != null ? String(field(row, 'COSTO')) : '',
    descripcion: field(row, 'DESCRIPCION') || '',
  }
}

export default function Medicamentos() {
  const mantener = puedeMantener()
  const [medicamentos, setMedicamentos] = useState([])
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

  const loadMedicamentos = useCallback(async () => {
    const id = ++reqId.current
    const query = { limit, offset }
    if (qDebounced.trim()) query.q = qDebounced.trim()
    const data = await api('/api/medicamentos', { query })
    if (id !== reqId.current) return
    setMedicamentos(Array.isArray(data?.datos) ? data.datos : [])
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
        await loadMedicamentos()
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
  }, [loadMedicamentos])

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
    setForm(formFromMedicamento(row))
    setFormOpen(true)
  }

  function validar() {
    if (!form.nombre.trim() || !form.codigoBarra.trim()) {
      toast.error('Nombre y código de barras son obligatorios')
      return false
    }
    const precio = Number(form.precioVenta)
    const costo = Number(form.costo)
    if (!Number.isFinite(precio) || precio < 0 || !Number.isFinite(costo) || costo < 0) {
      toast.error('Precio de venta y costo deben ser mayores o iguales a 0')
      return false
    }
    return true
  }

  function cuerpo() {
    return {
      nombre: form.nombre.trim(),
      codigoBarra: form.codigoBarra.trim(),
      principioActivo: form.principioActivo.trim(),
      presentacion: form.presentacion.trim(),
      laboratorio: form.laboratorio.trim(),
      recetaRequerida: form.receta ? 1 : 0,
      precioVenta: Number(form.precioVenta),
      costo: Number(form.costo),
      descripcion: form.descripcion.trim(),
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validar()) return
    setSaving(true)
    try {
      if (formMode === 'create') {
        await api('/api/medicamentos', { method: 'POST', body: cuerpo() })
        toast.success('Medicamento registrado')
      } else {
        await api(`/api/medicamentos/${editId}`, { method: 'PUT', body: cuerpo() })
        toast.success('Medicamento actualizado')
      }
      setFormOpen(false)
      await loadMedicamentos()
    } catch (err) {
      toast.error(err.message || 'No se pudo guardar el medicamento')
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(id) {
    setDetailOpen(true)
    setDetail(null)
    try {
      const data = await api(`/api/medicamentos/${id}`)
      setDetail(data.datos)
    } catch (err) {
      toast.error(err.message || 'No se pudo cargar el medicamento')
      setDetailOpen(false)
    }
  }

  async function handleDelete() {
    const id = field(deleteTarget, 'ID')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/medicamentos/${id}`, { method: 'DELETE' })
      toast.success('Medicamento desactivado')
      setDeleteOpen(false)
      setDeleteTarget(null)
      await loadMedicamentos()
    } catch (err) {
      toast.error(err.message || 'No se pudo desactivar el medicamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivar(row) {
    const id = field(row, 'ID')
    if (!id) return
    setSaving(true)
    try {
      await api(`/api/medicamentos/${id}`, { method: 'PATCH', body: { estado: 'ACTIVO' } })
      toast.success('Medicamento reactivado')
      await loadMedicamentos()
    } catch (err) {
      toast.error(err.message || 'No se pudo reactivar el medicamento')
    } finally {
      setSaving(false)
    }
  }

  if (loading && medicamentos.length === 0 && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  if (error && medicamentos.length === 0) {
    return <p className="text-destructive">No se pudieron cargar los medicamentos: {error}</p>
  }

  const lotesRecientes = detail?.LOTES_RECIENTES || detail?.lotes_recientes || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Inventario · Medicamentos</p>
          <h1 className="font-display text-3xl">Medicamentos</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Registro de medicamentos
          </p>
        </div>
        {mantener ? (
          <Button className="gap-2" onClick={abrirAlta}>
            <Plus className="h-4 w-4" />
            Nuevo medicamento
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <CardDescription>Medicamentos</CardDescription>
          <div className="rounded-md bg-secondary p-2 text-primary">
            <Package className="h-4 w-4" />
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
            <CardTitle>Catalogo</CardTitle>
            <CardDescription>{total} registros</CardDescription>
          </div>
          <Buscador value={q} onChange={setQ} placeholder="Buscar nombre, codigo, principio o laboratorio…" />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {medicamentos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay medicamentos con ese filtro</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Codigo de barras</TableHead>
                  <TableHead>Laboratorio</TableHead>
                  <TableHead>Precio venta</TableHead>
                  <TableHead>Receta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicamentos.map((row) => {
                  const id = field(row, 'ID')
                  const estado = String(field(row, 'ESTADO') || 'ACTIVO').toUpperCase()
                  const activo = estado === 'ACTIVO'
                  const receta = Number(field(row, 'RECETA_REQUERIDA')) === 1
                  return (
                    <TableRow key={id}>
                      <TableCell className="font-medium">{field(row, 'NOMBRE') || '—'}</TableCell>
                      <TableCell>{field(row, 'CODIGO_BARRA') || '—'}</TableCell>
                      <TableCell>{field(row, 'LABORATORIO') || '—'}</TableCell>
                      <TableCell>{gtq(field(row, 'PRECIO_VENTA'))}</TableCell>
                      <TableCell>
                        {receta ? <Badge variant="warn">Receta</Badge> : <Badge variant="secondary">No</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={activo ? 'ok' : 'danger'}>{activo ? 'Activo' : 'Inactivo'}</Badge>
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
                          {mantener && activo ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Desactivar"
                              onClick={() => {
                                setDeleteTarget(row)
                                setDeleteOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                          {mantener && !activo ? (
                            <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => handleReactivar(row)}>
                              Reactivar
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === 'create' ? 'Nuevo medicamento' : 'Editar medicamento'}</DialogTitle>
            <DialogDescription>El codigo de barras es unico, tambien si el SKU esta inactivo</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nombreMed">Nombre</Label>
              <Input id="nombreMed" value={form.nombre} onChange={(e) => setCampo('nombre', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="codigoMed">Codigo de barras</Label>
              <Input id="codigoMed" value={form.codigoBarra} onChange={(e) => setCampo('codigoBarra', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="labMed">Laboratorio</Label>
              <Input id="labMed" value={form.laboratorio} onChange={(e) => setCampo('laboratorio', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="principioMed">Principio activo</Label>
              <Input id="principioMed" value={form.principioActivo} onChange={(e) => setCampo('principioActivo', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="presentacionMed">Presentación</Label>
              <Input id="presentacionMed" value={form.presentacion} onChange={(e) => setCampo('presentacion', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="precioMed">Precio de venta</Label>
              <Input id="precioMed" type="number" min="0" step="0.01" value={form.precioVenta} onChange={(e) => setCampo('precioVenta', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costoMed">Costo</Label>
              <Input id="costoMed" type="number" min="0" step="0.01" value={form.costo} onChange={(e) => setCampo('costo', e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="descMed">Descripción</Label>
              <Input id="descMed" value={form.descripcion} onChange={(e) => setCampo('descripcion', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.receta} onChange={(e) => setCampo('receta', e.target.checked)} />
              Requiere receta
            </label>
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
            <DialogTitle>{field(detail, 'NOMBRE') || 'Medicamento'}</DialogTitle>
            <DialogDescription>{field(detail, 'CODIGO_BARRA') || '—'}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {field(detail, 'LABORATORIO') || 'Sin laboratorio'} · {gtq(field(detail, 'PRECIO_VENTA'))}
                {Number(field(detail, 'RECETA_REQUERIDA')) === 1 ? ' · Requiere receta' : ''}
              </p>
              <p className="text-sm">{field(detail, 'DESCRIPCION') || 'Sin descripción'}</p>
              {lotesRecientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin lotes recientes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Sucursal</TableHead>
                      <TableHead>Cantidad</TableHead>
                      <TableHead>Vence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotesRecientes.map((lote) => (
                      <TableRow key={field(lote, 'ID')}>
                        <TableCell>{field(lote, 'LOTE') || '—'}</TableCell>
                        <TableCell>{field(lote, 'SUCURSAL_NOMBRE') || '—'}</TableCell>
                        <TableCell>{field(lote, 'CANTIDAD') ?? '—'}</TableCell>
                        <TableCell>{field(lote, 'FECHA_VENCIMIENTO') || '—'}</TableCell>
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
            <DialogTitle>Desactivar medicamento</DialogTitle>
            <DialogDescription>
              La baja es lógica. Un inactivo no sale en compras ni en el POS. Los lotes y tickets no se borran.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm">
            ¿Desactivar <span className="font-medium">{field(deleteTarget, 'NOMBRE')}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? 'Desactivando…' : 'Desactivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
