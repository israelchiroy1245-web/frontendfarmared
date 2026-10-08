import { useCallback, useEffect, useState } from 'react'
import { Headset, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { api, gtq } from '@/lib/utils'
import { getRol } from '@/lib/roles'

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

const DEPARTAMENTOS = [
  'Guatemala',
  'Sacatepéquez',
  'Quetzaltenango',
  'Escuintla',
  'Alta Verapaz',
  'Huehuetenango',
  'Izabal',
  'Petén',
  'Suchitepéquez',
]
const AVISO_RECETA = 'Requiere receta (MSPAS). El cobro no se bloquea.'
const METODOS = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']
const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function lineaVacia() {
  return { medicamentoId: '', cantidad: '1' }
}

function puedeConsultar() {
  return ['CALL_CENTER', 'ADMIN'].includes(getRol())
}

function puedeCrear() {
  return ['CALL_CENTER', 'ADMIN'].includes(getRol())
}

export default function CallCenter() {
  const consultar = puedeConsultar()
  const crear = puedeCrear()
  const [medicamentos, setMedicamentos] = useState([])
  const [departamento, setDepartamento] = useState('Guatemala')
  const [latitud, setLatitud] = useState('')
  const [longitud, setLongitud] = useState('')
  const [lineas, setLineas] = useState([lineaVacia()])
  const [resultado, setResultado] = useState(null)
  const [elegida, setElegida] = useState(null)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [telefono, setTelefono] = useState('')
  const [nit, setNit] = useState('CF')
  const [direccion, setDireccion] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [metodoPago, setMetodoPago] = useState('EFECTIVO')
  const [consultando, setConsultando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const loadMeds = useCallback(async () => {
    const med = await api('/api/catalogos/medicamentos')
    setMedicamentos(Array.isArray(med?.datos) ? med.datos : [])
  }, [])

  useEffect(() => {
    loadMeds().catch((e) => toast.error(e.message || 'No se cargó el catálogo'))
  }, [loadMeds])

  function setLinea(index, key, value) {
    setLineas((prev) => prev.map((linea, i) => (i === index ? { ...linea, [key]: value } : linea)))
  }

  function requiereReceta(medicamentoId) {
    const med = medicamentos.find((item) => String(field(item, 'ID')) === String(medicamentoId))
    return Number(field(med, 'RECETA_REQUERIDA')) === 1
  }

  function elegirMedicamento(index, medicamentoId) {
    setLinea(index, 'medicamentoId', medicamentoId)
    if (requiereReceta(medicamentoId)) toast.message(AVISO_RECETA)
  }

  const hayReceta = lineas.some((linea) => requiereReceta(linea.medicamentoId))

  function itemsValidos() {
    const items = []
    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad)
      if (!linea.medicamentoId || !Number.isFinite(cantidad) || cantidad <= 0) return null
      items.push({ medicamentoId: Number(linea.medicamentoId), cantidad })
    }
    return items
  }

  async function consultarCobertura(e) {
    e.preventDefault()
    const items = itemsValidos()
    if (!items) {
      toast.error('Cada línea necesita medicamento y cantidad mayor a cero')
      return
    }
    setConsultando(true)
    try {
      const body = { departamento, items }
      if (latitud.trim() && longitud.trim()) {
        body.latitud = Number(latitud)
        body.longitud = Number(longitud)
      }
      const data = await api('/api/call-center/consulta', { method: 'POST', body })
      setResultado(data)
      setElegida(data.mejorOpcion || null)
      toast.success(data.mensaje || 'Cobertura consultada')
      if (items.some((item) => requiereReceta(item.medicamentoId))) toast.message(AVISO_RECETA)
    } catch (err) {
      toast.error(err.message || 'No se pudo consultar la cobertura')
    } finally {
      setConsultando(false)
    }
  }

  async function crearPedido(e) {
    e.preventDefault()
    if (!crear) return
    const items = itemsValidos()
    if (!items) {
      toast.error('Cada línea necesita medicamento y cantidad mayor a cero')
      return
    }
    if (!nombre.trim() || !direccion.trim()) {
      toast.error('Nombre y dirección de entrega son obligatorios')
      return
    }
    setGuardando(true)
    try {
      const data = await api('/api/pedidos', {
        method: 'POST',
        body: {
          cliente: {
            nombre: nombre.trim(),
            apellido: apellido.trim() || undefined,
            telefono: telefono.trim() || undefined,
            nit: nit.trim() || 'CF',
          },
          direccionEntrega: direccion.trim(),
          departamento,
          municipio: municipio.trim() || undefined,
          latitud: latitud.trim() ? Number(latitud) : undefined,
          longitud: longitud.trim() ? Number(longitud) : undefined,
          sucursalId: elegida?.sucursalId ? Number(elegida.sucursalId) : undefined,
          metodoPago,
          canal: 'CALL_CENTER',
          items,
        },
      })
      toast.success(data.mensaje || 'Pedido confirmado')
    } catch (err) {
      toast.error(err.message || 'No se pudo crear el pedido')
    } finally {
      setGuardando(false)
    }
  }

  if (!consultar) {
    return <p className="text-destructive">Tu rol no puede usar el call center.</p>
  }

  const opciones = resultado?.opciones || []

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Logística · Call center</p>
        <h1 className="font-display text-3xl">Call center</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          La consulta elige la sucursal más cercana con stock completo. Si no hay coordenadas, usa el departamento. El pedido nace confirmado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headset className="h-4 w-4" />
            Consulta de cobertura
          </CardTitle>
          <CardDescription>Distancia en kilómetros y tiempo estimado de entrega.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={consultarCobertura} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="depto">Departamento</Label>
                <select id="depto" className={selectClass} value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
                  {DEPARTAMENTOS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lat">Latitud</Label>
                <Input id="lat" value={latitud} onChange={(e) => setLatitud(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lon">Longitud</Label>
                <Input id="lon" value={longitud} onChange={(e) => setLongitud(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            {lineas.map((linea, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-5">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label>Medicamento</Label>
                  <select className={selectClass} value={linea.medicamentoId} onChange={(e) => elegirMedicamento(index, e.target.value)}>
                    <option value="">Selecciona</option>
                    {medicamentos.map((m) => (
                      <option key={field(m, 'ID')} value={field(m, 'ID')}>{field(m, 'NOMBRE_MEDICAMENTO') || field(m, 'Nombre_medic')}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cantidad</Label>
                  <div className="flex gap-1">
                    <Input type="number" min="1" value={linea.cantidad} onChange={(e) => setLinea(index, 'cantidad', e.target.value)} />
                    <Button type="button" variant="ghost" size="icon-sm" title="Quitar" disabled={lineas.length === 1} onClick={() => setLineas((prev) => prev.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {hayReceta ? <p className="text-sm">Requiere receta</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>
                <Plus className="h-4 w-4" />
                Línea
              </Button>
              <Button type="submit" disabled={consultando}>{consultando ? 'Consultando…' : 'Consultar cobertura'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {opciones.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sucursales</CardTitle>
            <CardDescription>
              {resultado?.mensaje}
              {hayReceta ? ' · Requiere receta' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sucursal</TableHead>
                  <TableHead>Km</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Estimado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {opciones.map((op) => (
                  <TableRow key={op.sucursalId}>
                    <TableCell className="font-medium">{op.nombre}</TableCell>
                    <TableCell>{op.distanciaKm}</TableCell>
                    <TableCell>{op.etaMinutos} min</TableCell>
                    <TableCell>
                      <Badge variant={op.tieneStockCompleto ? 'ok' : 'warn'}>{op.tieneStockCompleto ? 'Completo' : 'Parcial'}</Badge>
                    </TableCell>
                    <TableCell>{gtq(op.subtotalEstimado)}</TableCell>
                    <TableCell>
                      <Button type="button" variant={elegida?.sucursalId === op.sucursalId ? 'default' : 'outline'} size="sm" onClick={() => setElegida(op)}>
                        Asignar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {crear ? (
        <Card>
          <CardHeader>
            <CardTitle>Pedido a domicilio</CardTitle>
            <CardDescription>
              {elegida ? `Sale de ${elegida.nombre}, ETA ${elegida.etaMinutos} min.` : 'Consulta primero para asignar sucursal. Sin sucursal, el servidor elige la más cercana.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={crearPedido} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="apellido">Apellido</Label>
                <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tel">Teléfono</Label>
                <Input id="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nit">NIT</Label>
                <Input id="nit" value={nit} onChange={(e) => setNit(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dir">Dirección de entrega</Label>
                <Input id="dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="muni">Municipio</Label>
                <Input id="muni" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pago">Pago</Label>
                <select id="pago" className={selectClass} value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                  {METODOS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Confirmar pedido'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
