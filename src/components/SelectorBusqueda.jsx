import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Hasta `limit` coincidencias. Si el texto es igual al nombre o al código, solo esa.
 */
export function coincidencias(items, query, limit = 5) {
  const q = normalizar(query)
  if (!q) return []
  const exactas = []
  const empiezan = []
  const contienen = []
  for (const item of items) {
    const label = normalizar(item.label)
    const hint = normalizar(item.hint)
    if (label === q || (hint && hint === q)) exactas.push(item)
    else if (label.startsWith(q) || (hint && hint.startsWith(q))) empiezan.push(item)
    else if (label.includes(q) || (hint && hint.includes(q))) contienen.push(item)
  }
  if (exactas.length) return exactas.slice(0, limit)
  return [...empiezan, ...contienen].slice(0, limit)
}

/**
 * Combo con búsqueda, sobre el Combobox de shadcn / Base UI.
 * items: [{ value, label, hint? }]
 * value / onChange: el value elegido, o '' si el texto ya no coincide.
 */
export default function SelectorBusqueda({
  items,
  value,
  onChange,
  placeholder = 'Buscar…',
  emptyText = 'Escribe para buscar.',
  disabled = false,
  id,
  limit = 5,
}) {
  const lista = items || []
  const seleccionado = lista.find((item) => String(item.value) === String(value ?? '')) || null
  const elegidoRef = useRef(seleccionado)
  const [query, setQuery] = useState(() => seleccionado?.label || '')
  const visibles = useMemo(() => coincidencias(lista, query, limit), [lista, query, limit])

  useEffect(() => {
    if (!seleccionado) return
    elegidoRef.current = seleccionado
    setQuery(seleccionado.label || '')
  }, [value, seleccionado])

  return (
    <Combobox
      items={visibles}
      value={seleccionado}
      inputValue={query}
      onInputValueChange={(next) => {
        setQuery(next)
        const elegido = elegidoRef.current
        if (elegido && normalizar(next) === normalizar(elegido.label)) return
        if (value) onChange?.('')
      }}
      onValueChange={(item) => {
        elegidoRef.current = item
        setQuery(item?.label || '')
        onChange?.(item ? String(item.value) : '')
      }}
      itemToStringLabel={(item) => item?.label || ''}
      isItemEqualToValue={(a, b) => String(a?.value) === String(b?.value)}
      filter={null}
      disabled={disabled}
      autoHighlight
    >
      <ComboboxInput id={id} placeholder={placeholder} disabled={disabled} />
      <ComboboxContent>
        <ComboboxEmpty>{query.trim() ? 'Sin coincidencias.' : emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              <span className="min-w-0 truncate">{item.label}</span>
              {item.hint ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.hint}</span> : null}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
