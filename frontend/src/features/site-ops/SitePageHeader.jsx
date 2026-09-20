import { cn } from '@/lib/cn'

/**
 * How every site screen opens.
 *
 * Tighter than the office page header: no description paragraph, because on a
 * phone that is a screen of reading before the first control. The title, the
 * one figure that matters, and the action.
 */
export function SitePageHeader({ title, count, countLabel, action, className, children }) {
  return (
    <header className={cn('mb-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-h3 leading-tight text-ink">{title}</h1>
          {count !== undefined && count !== null && (
            <p className="mt-0.5 text-tiny text-muted">
              <span className="tabular text-ink">{count}</span> {countLabel}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </header>
  )
}

/** A horizontal filter strip. Scrolls rather than wraps, so the height is fixed. */
export function FilterStrip({ options, value, onChange, className }) {
  return (
    <div className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0', className)}>
      {options.map((option) => {
        const optionValue = option.value ?? option
        const active = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={active}
            className={cn(
              'shrink-0 rounded-pill border px-3.5 py-2 text-tiny font-medium transition-colors duration-150',
              active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-muted',
            )}
          >
            {option.label ?? option}
            {option.count !== undefined && (
              <span className={cn('ml-1.5 tabular', active ? 'text-paper/70' : 'text-subtle')}>{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
