import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/Panel'

/** A chart with its title, legend and figure treated as one unit. */
export function ChartCard({ title, description, legend, action, height = 280, children, className }) {
  return (
    <Panel className={cn('flex flex-col', className)}>
      <div className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title truncate">{title}</h3>
          {description && <p className="mt-0.5 text-tiny text-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {legend && <ChartLegend items={legend} />}
          {action}
        </div>
      </div>
      <div className="min-h-0 flex-1 px-2 py-4 sm:px-3" style={{ minHeight: height }}>
        {children}
      </div>
    </Panel>
  )
}

export function ChartLegend({ items }) {
  return (
    <ul className="flex items-center gap-3.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-tiny text-muted">
          <span
            className="h-[3px] w-4 rounded-pill"
            style={{
              background: item.dashed ? 'transparent' : item.color,
              borderTop: item.dashed ? `2px dashed ${item.color}` : undefined,
            }}
            aria-hidden
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
