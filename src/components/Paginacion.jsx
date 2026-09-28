import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const selectClass =
  'h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default function Paginacion({ total = 0, limit = 50, offset = 0, onChange }) {
  const page = Math.floor(offset / limit) + 1
  const pages = Math.max(1, Math.ceil(total / limit) || 1)
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {from}–{to} de {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Filas
          <select
            className={selectClass}
            value={limit}
            aria-label="Filas por página"
            onChange={(e) => onChange({ limit: Number(e.target.value), offset: 0 })}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange({ limit, offset: Math.max(0, offset - limit) })}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {page} de {pages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange({ limit, offset: offset + limit })}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
