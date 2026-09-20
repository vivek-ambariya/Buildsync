import { AlertTriangle, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Panel } from './Panel'

/**
 * An empty screen is an invitation to act, so it always names the next step.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16', className)}>
      {Icon && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-line bg-raised text-subtle">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-display text-h4 text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-base leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/**
 * Errors say what failed and offer the way out. The stack stays in the console.
 */
export function ErrorState({ title = 'Something went wrong', description, onRetry, className, compact }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-6 py-10' : 'px-6 py-16', className)}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-critical/25 bg-critical-wash text-critical">
        <AlertTriangle size={18} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-h4 text-ink">{title}</h3>
      <p className="mt-1.5 max-w-sm text-base leading-relaxed text-muted">
        {description || 'We could not load this data.'}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw size={14} />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Wraps a panel around an error, for use inside a grid of panels. */
export function ErrorPanel(props) {
  return (
    <Panel>
      <ErrorState compact {...props} />
    </Panel>
  )
}
