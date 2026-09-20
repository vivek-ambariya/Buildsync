import { useLayoutEffect, useRef } from 'react'
import { Package, Radar, TrendingDown } from 'lucide-react'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'
import { gsap, parallax, wipeIn } from './scroll'

/**
 * The product, assembled one panel at a time as the visitor scrolls.
 *
 * Everything sits on one grid and nothing overlaps: an earlier version drifted
 * the panels at different parallax rates, which looked like depth in isolation
 * but collided once two panels were on screen together — the KPI strip landed
 * on the chart's axis labels. Depth now comes from the order things arrive in,
 * not from their position, and only the background grid still drifts.
 */

const KPIS = [
  { label: 'Active projects', value: '8', caption: 'of 8 in the portfolio' },
  { label: 'Projects at risk', value: '4', caption: 'behind plan or overspending', tone: 'critical' },
  { label: 'Overall progress', value: '46.5%', caption: '+1.6 pts this week' },
  { label: 'Under management', value: '₹114.70 Cr', caption: '43% committed' },
]

const HEALTH = [
  { name: 'Riverfront Residency C', actual: 91, planned: 86.7, tone: 'healthy' },
  { name: 'Green Valley Residences', actual: 71, planned: 59.4, tone: 'healthy' },
  { name: 'Metro Commercial Hub', actual: 44, planned: 42.9, tone: 'healthy' },
  { name: 'Skyline Tower', actual: 40, planned: 56.6, tone: 'critical' },
  { name: 'Sardar Industrial Park II', actual: 33, planned: 41.3, tone: 'warning' },
]

const STOCK = [
  { name: 'TMT Steel Fe550D', project: 'Skyline Tower', cover: 6, lead: 9, tone: 'critical' },
  { name: 'Structural Glazing Unit', project: 'Metro Commercial Hub', cover: 8, lead: 21, tone: 'critical' },
  { name: 'AAC Blocks 600×200×150', project: 'LJ Business Center', cover: 7, lead: 6, tone: 'warning' },
]

export function ProductPreview() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    const context = gsap.context(() => {
      wipeIn(gsap.utils.toArray('[data-wipe]', scope), { trigger: scope })

      if (prefersReducedMotion()) return

      // Only the background drifts. Nothing that can collide with a neighbour
      // is given a rate of its own.
      parallax(scope.querySelector('[data-bg]'), { distance: 70, trigger: scope })

      // The panels arrive in reading order, one at a time, tied to scroll
      // position rather than played on a timer.
      const cards = gsap.utils.toArray('[data-card]', scope)
      gsap.fromTo(
        cards,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          ease: 'power2.out',
          duration: 0.6,
          stagger: 0.45,
          scrollTrigger: {
            trigger: scope,
            start: 'top 74%',
            end: 'bottom 88%',
            scrub: 0.65,
          },
        },
      )

      // The curve draws itself once its panel has landed.
      gsap.fromTo(
        scope.querySelectorAll('[data-chart-line]'),
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          ease: 'none',
          stagger: 0.12,
          scrollTrigger: { trigger: '[data-chart-panel]', start: 'top 82%', end: 'bottom 70%', scrub: 0.7 },
        },
      )

      // Health bars grow to their real proportions as the panel settles.
      gsap.fromTo(
        scope.querySelectorAll('[data-bar]'),
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          ease: 'power2.out',
          duration: 0.8,
          stagger: 0.1,
          scrollTrigger: { trigger: '[data-health-panel]', start: 'top 84%', once: true },
        },
      )
    }, root)

    return () => context.revert()
  }, [])

  return (
    <section ref={root} className="relative overflow-hidden border-t border-line py-20 lg:py-28">
      <div data-bg className="survey-grid absolute inset-0 -z-10" aria-hidden />

      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-tiny font-medium text-muted" data-wipe>
            The command centre
          </p>
          <h2 className="mt-3 font-display text-h1 leading-[1.08] text-ink">
            <span className="block" data-wipe>
              One screen a project
            </span>
            <span className="block" data-wipe>
              director can run a morning on.
            </span>
          </h2>
          <p className="mt-5 text-lead text-muted">
            Keep scrolling and it assembles itself, in the order you would read it.
          </p>
        </div>

        {/* One grid. Four KPI cells, then three panels. Nothing overlaps. */}
        <div className="mt-12 grid gap-4 lg:mt-16">
          {/* KPI row — each cell arrives on its own */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {KPIS.map((kpi) => (
              <div
                key={kpi.label}
                data-card
                className={cn(
                  'relative overflow-hidden rounded-panel border border-line bg-surface px-5 py-4',
                  kpi.tone === 'critical' && 'rule-left text-critical',
                )}
              >
                <div className={cn(kpi.tone === 'critical' && 'pl-3')}>
                  <p className="text-tiny text-muted">{kpi.label}</p>
                  <p
                    className={cn(
                      'mt-2 font-display text-metric tabular',
                      kpi.tone === 'critical' ? 'text-critical' : 'text-ink',
                    )}
                  >
                    {kpi.value}
                  </p>
                  <p className="mt-2 text-micro text-subtle">{kpi.caption}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart beside the finding it produced */}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
            <div
              data-card
              data-chart-panel
              className="overflow-hidden rounded-panel border border-line bg-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                <div className="min-w-0">
                  <p className="panel-title">Portfolio progress</p>
                  <p className="mt-0.5 text-micro text-muted">
                    Mean completion across every live site, against the schedules
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3.5 text-micro text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[3px] w-4 rounded-pill bg-ink" aria-hidden />
                    Actual
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0 w-4 border-t-2 border-dashed border-amber" aria-hidden />
                    Planned
                  </span>
                </div>
              </div>

              <div className="px-3 pb-4 pt-5">
                <svg viewBox="0 0 640 220" className="h-[220px] w-full" aria-hidden>
                  {[40, 82, 124, 166].map((y) => (
                    <line key={y} x1={46} y1={y} x2={628} y2={y} className="stroke-line" strokeWidth="1" />
                  ))}
                  {['60%', '50%', '40%', '30%'].map((label, index) => (
                    <text key={label} x={38} y={44 + index * 42} className="fill-subtle" fontSize="10" textAnchor="end">
                      {label}
                    </text>
                  ))}

                  <defs>
                    <linearGradient id="preview-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(var(--ink))" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="rgb(var(--ink))" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M54 154 C 152 146, 262 130, 362 114 C 452 100, 542 86, 622 74 L622 178 L54 178 Z"
                    fill="url(#preview-fill)"
                  />
                  <path
                    data-chart-line
                    pathLength={1}
                    strokeDasharray={1}
                    d="M54 142 C 152 132, 262 112, 362 94 C 452 78, 542 60, 622 46"
                    className="stroke-amber"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    data-chart-line
                    pathLength={1}
                    strokeDasharray={1}
                    d="M54 154 C 152 146, 262 130, 362 114 C 452 100, 542 86, 622 74"
                    className="stroke-ink"
                    strokeWidth="2.4"
                    fill="none"
                  />

                  {['26 Jul', '09 Aug', '23 Aug', '06 Sep', '20 Sep'].map((label, index) => (
                    <text key={label} x={54 + index * 143} y={206} className="fill-subtle" fontSize="10">
                      {label}
                    </text>
                  ))}
                </svg>
              </div>
            </div>

            <div
              data-card
              className="rule-left overflow-hidden rounded-panel border border-line bg-surface text-critical"
            >
              <div className="p-5 pl-6">
                <div className="flex items-center gap-2">
                  <TrendingDown size={13} className="shrink-0 text-critical" strokeWidth={2} />
                  <span className="truncate text-tiny font-medium text-muted">Skyline Tower</span>
                  <span className="ml-auto shrink-0 rounded-pill border border-critical/25 bg-critical-wash px-2 py-0.5 text-micro font-medium text-critical">
                    High
                  </span>
                </div>
                <h3 className="mt-2 font-display text-[0.9375rem] font-semibold leading-snug text-ink">
                  Progress is 16.7 points behind plan
                </h3>
                <p className="mt-2 text-base leading-relaxed text-muted">
                  Actual progress is 39.9% against a planned 56.6%. At the current rate of
                  0.093% a day, completion lands around 19 Jun 2028.
                </p>
                <div className="mt-4 flex gap-6 border-t border-line pt-3.5">
                  <div>
                    <p className="text-micro text-subtle">Progress variance</p>
                    <p className="mt-0.5 font-display text-[1.0625rem] font-semibold tabular text-critical">−16.7%</p>
                  </div>
                  <div>
                    <p className="text-micro text-subtle">Forecast overrun</p>
                    <p className="mt-0.5 font-display text-[1.0625rem] font-semibold tabular text-ink">308 days</p>
                  </div>
                </div>
                <div className="mt-3.5 flex items-start gap-2 rounded-control bg-raised px-3 py-2.5">
                  <Radar size={13} className="mt-0.5 shrink-0 text-subtle" />
                  <p className="text-tiny leading-relaxed text-muted">
                    Re-sequence the critical path and add a second shift on the lagging phase.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Health beside the stock that will stop work first */}
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
            <div
              data-card
              data-health-panel
              className="overflow-hidden rounded-panel border border-line bg-surface"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <p className="panel-title">Project health</p>
                <span className="text-micro text-muted">completion against the planned curve</span>
              </div>
              <ul className="divide-y divide-line">
                {HEALTH.map((row) => (
                  <li key={row.name} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{row.name}</span>
                      <span className="shrink-0 text-base tabular text-ink">{row.actual}%</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
                        <div
                          data-bar
                          className={cn(
                            'h-full origin-left rounded-pill',
                            row.tone === 'critical' ? 'bg-critical' : row.tone === 'warning' ? 'bg-amber' : 'bg-healthy',
                          )}
                          style={{ width: `${row.actual}%` }}
                        />
                        <span className="absolute top-0 h-full w-px bg-ink/45" style={{ left: `${row.planned}%` }} aria-hidden />
                      </div>
                      <span
                        className={cn(
                          'w-14 shrink-0 text-right text-micro tabular',
                          row.tone === 'critical' ? 'text-critical' : row.tone === 'warning' ? 'text-amber-deep' : 'text-healthy',
                        )}
                      >
                        {row.actual - row.planned > 0 ? '+' : ''}
                        {(row.actual - row.planned).toFixed(1)} pts
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div data-card className="overflow-hidden rounded-panel border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <p className="panel-title">Stock to reorder</p>
                <span className="text-micro text-muted">cover vs lead time</span>
              </div>
              <ul className="divide-y divide-line">
                {STOCK.map((item) => (
                  <li key={item.name} className="flex items-start gap-3 px-5 py-3.5">
                    <Package
                      size={14}
                      className={cn('mt-0.5 shrink-0', item.tone === 'critical' ? 'text-critical' : 'text-amber-deep')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-ink">{item.name}</p>
                      <p className="truncate text-micro text-subtle">{item.project}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          'text-base tabular',
                          item.tone === 'critical' ? 'text-critical' : 'text-amber-deep',
                        )}
                      >
                        {item.cover}d
                      </p>
                      <p className="text-micro text-subtle">{item.lead}d lead</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line bg-raised px-5 py-3 text-tiny leading-relaxed text-muted">
                Every one of these runs dry before a replacement order could arrive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
