import { cn } from '@/lib/cn'
import { useGrowBar } from '@/animations/useMotion'

const TONES = {
  healthy: 'bg-healthy',
  warning: 'bg-amber',
  critical: 'bg-critical',
  info: 'bg-info',
  ink: 'bg-ink',
}

/**
 * A progress bar that can show the planned position as a marker, so the gap
 * between plan and reality is visible without reading two numbers.
 */
export function ProgressBar({
  value = 0,
  planned = null,
  tone = 'ink',
  height = 'h-1.5',
  delay = 0,
  className,
  showPlannedMarker = true,
}) {
  const barRef = useGrowBar(value, delay)
  const clamped = Math.max(0, Math.min(100, planned ?? 0))

  return (
    <div className={cn('relative w-full overflow-hidden rounded-pill bg-line', height, className)}>
      <div ref={barRef} className={cn('h-full rounded-pill', TONES[tone] || TONES.ink)} style={{ width: 0 }} />
      {showPlannedMarker && planned !== null && planned > 0 && (
        <span
          className="absolute top-0 h-full w-px bg-ink/45"
          style={{ left: `${clamped}%` }}
          title={`Planned ${planned}%`}
          aria-hidden
        />
      )}
    </div>
  )
}
