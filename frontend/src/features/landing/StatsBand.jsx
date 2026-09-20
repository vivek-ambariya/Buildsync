import { useLayoutEffect, useRef } from 'react'

import { prefersReducedMotion } from '@/animations'
import { gsap, scrubCount } from './scroll'

/**
 * The portfolio in four figures, each counting up as the band is scrolled into
 * place. The count is tied to scroll position rather than a timer, so scrolling
 * back down runs it again — the number is a read-out of where you are, not an
 * animation that plays once and is gone.
 */
const STATS = [
  { value: 8, label: 'live projects', caption: 'across four cities', format: (v) => Math.round(v).toString() },
  { value: 114.7, label: 'crore under management', caption: 'approved budget', format: (v) => `₹${v.toFixed(1)}` },
  { value: 37, label: 'open risk findings', caption: 'ranked by impact', format: (v) => Math.round(v).toString() },
  { value: 232, label: 'tasks tracked', caption: 'across five build phases', format: (v) => Math.round(v).toString() },
]

export function StatsBand() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    const context = gsap.context(() => {
      const nodes = gsap.utils.toArray('[data-count]', scope)
      nodes.forEach((node, index) => {
        scrubCount(node, STATS[index].value, { trigger: scope, format: STATS[index].format })
      })

      if (prefersReducedMotion()) return

      // A hairline that draws across the band as it arrives.
      gsap.fromTo(
        '[data-rule]',
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: 'left center',
          ease: 'none',
          scrollTrigger: { trigger: scope, start: 'top 90%', end: 'top 40%', scrub: 0.5 },
        },
      )
    }, root)

    return () => context.revert()
  }, [])

  return (
    <section ref={root} className="border-t border-line bg-surface py-16 lg:py-20">
      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
        <div className="h-px w-full bg-line">
          <div data-rule className="h-px origin-left bg-amber" style={{ transform: 'scaleX(0)' }} aria-hidden />
        </div>

        <dl className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <dd className="font-display text-h1 tabular leading-none text-ink">
                <span data-count>{stat.format(0)}</span>
              </dd>
              <dt className="mt-3 text-body text-ink">{stat.label}</dt>
              <dd className="mt-0.5 text-tiny text-subtle">{stat.caption}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
