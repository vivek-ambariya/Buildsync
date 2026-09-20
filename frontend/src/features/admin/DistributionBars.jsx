import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'

const TONES = {
  ink: 'bg-ink',
  amber: 'bg-amber',
  healthy: 'bg-healthy',
  critical: 'bg-critical',
  info: 'bg-info',
  neutral: 'bg-line-strong',
}

/**
 * A ranked breakdown, as bars rather than a pie.
 *
 * With four to six categories the question is "which is biggest, and by how
 * much" — that comparison is read along a shared baseline far more accurately
 * than around a circle. Bars also label themselves without a legend.
 */
export function DistributionBars({ rows = [], total, className, emptyLabel = 'Nothing recorded yet' }) {
  const scope = useRef(null)
  const sum = total ?? rows.reduce((acc, row) => acc + (row.count || 0), 0)

  useLayoutEffect(() => {
    const bars = scope.current?.querySelectorAll('[data-bar]')
    if (!bars?.length) return
    if (prefersReducedMotion()) {
      bars.forEach((bar) => gsap.set(bar, { width: bar.dataset.width }))
      return
    }
    const tween = gsap.fromTo(
      bars,
      { width: 0 },
      {
        width: (index, target) => target.dataset.width,
        duration: 0.55,
        ease: 'power3.out',
        stagger: 0.05,
      },
    )
    return () => tween.kill()
  }, [rows])

  if (!rows.length) {
    return <p className={cn('px-5 py-8 text-center text-base text-subtle', className)}>{emptyLabel}</p>
  }

  return (
    <ul ref={scope} className={cn('space-y-3.5', className)}>
      {rows.map((row) => {
        const share = sum ? (row.count / sum) * 100 : 0
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-base text-ink">{row.label}</span>
              <span className="shrink-0 text-tiny tabular text-muted">
                <span className="font-medium text-ink">{row.count}</span>
                <span className="ml-1.5 text-subtle">{share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-pill bg-line">
              <div
                data-bar
                data-width={`${Math.max(share, row.count ? 2 : 0)}%`}
                className={cn('h-full rounded-pill', TONES[row.tone] || TONES.ink)}
                style={{ width: 0 }}
              />
            </div>
          </>
        )
        return (
          <li key={row.label}>
            {row.to ? (
              <Link
                to={row.to}
                className="-mx-2 block rounded-control px-2 py-1 transition-colors duration-150 hover:bg-raised"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
