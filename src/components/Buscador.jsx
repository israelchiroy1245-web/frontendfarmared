import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Buscador reutilizable con ícono.
 *
 * @example
 * <Buscador value={q} onChange={setQ} placeholder="Buscar…" />
 */
export default function Buscador({
  value,
  onChange,
  placeholder = 'Buscar…',
  className,
  inputClassName,
  id,
  ...props
}) {
  return (
    <div className={cn('relative w-full sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn('pl-9', inputClassName)}
        {...props}
      />
    </div>
  )
}
