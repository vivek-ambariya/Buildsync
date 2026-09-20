import { cn } from '@/lib/cn'
import { titleise } from '@/lib/format'

/** Colour carries meaning: green healthy, amber warning, red critical, blue neutral info. */
const TONES = {
  healthy: 'border-healthy/25 bg-healthy-wash text-healthy',
  active: 'border-healthy/25 bg-healthy-wash text-healthy',
  completed: 'border-healthy/25 bg-healthy-wash text-healthy',
  in_progress: 'border-info/25 bg-info-wash text-info',
  planning: 'border-info/25 bg-info-wash text-info',
  info: 'border-info/25 bg-info-wash text-info',
  not_started: 'border-line-strong bg-raised text-muted',
  on_hold: 'border-line-strong bg-raised text-muted',
  neutral: 'border-line-strong bg-raised text-muted',
  low_stock: 'border-amber/35 bg-amber-wash text-amber-deep',
  warning: 'border-amber/35 bg-amber-wash text-amber-deep',
  at_risk: 'border-amber/35 bg-amber-wash text-amber-deep',
  medium: 'border-amber/35 bg-amber-wash text-amber-deep',
  delayed: 'border-critical/25 bg-critical-wash text-critical',
  critical: 'border-critical/25 bg-critical-wash text-critical',
  high: 'border-critical/25 bg-critical-wash text-critical',
  low: 'border-line-strong bg-raised text-muted',
}

const LABELS = {
  at_risk: 'At risk',
  in_progress: 'In progress',
  not_started: 'Not started',
  low_stock: 'Low stock',
  on_hold: 'On hold',
}

export function StatusBadge({ status, label, pulse = false, className, size = 'md' }) {
  const tone = TONES[status] || TONES.neutral
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-micro' : 'px-2.5 py-1 text-tiny',
        tone,
        className,
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-current" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {label || LABELS[status] || titleise(status)}
    </span>
  )
}
