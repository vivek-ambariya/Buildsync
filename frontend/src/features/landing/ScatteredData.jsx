import { useLayoutEffect, useRef } from 'react'
import { ArrowDown, Check } from 'lucide-react'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'
import { gsap, wipeIn } from './scroll'

/**
 * Where construction data actually lives today.
 *
 * The rows drift in opposite directions as the visitor scrolls, so the data is
 * literally never still and never lines up — which is the problem being
 * described. At the end of the section the drift stops and everything
 * collapses into one record, which is the claim being made.
 */

const SOURCES = [
  ['Excel tracker', 'Rev 7 · three versions in circulation'],
  ['WhatsApp group', 'Today’s pour confirmed in a voice note'],
  ['Printed BOQ', 'Revision 3 · in a drawer at site'],
  ['Vendor invoice', 'Emailed to whoever raised the PO'],
  ['Site diary', 'Handwritten · collected month end'],
  ['Drawing folder', 'Latest revision unclear'],
  ['Measurement book', 'Pending the engineer’s signature'],
  ['Labour muster', 'Counted on paper at the gate'],
  ['Cube test report', 'Faxed from the lab'],
  ['Purchase order', 'In the accountant’s inbox'],
  ['Material challan', 'Stapled to the gate register'],
  ['RA bill', 'Awaiting certification'],
]

// Three rows, each a different slice, so no row repeats its neighbour.
const ROWS = [
  SOURCES.slice(0, 5),
  SOURCES.slice(5, 9),
  SOURCES.slice(9),
]

export function ScatteredData() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope || prefersReducedMotion()) return undefined

    const context = gsap.context(() => {
      wipeIn(gsap.utils.toArray('[data-wipe]', scope), { trigger: scope })

      // Opposing drift: rows move past each other as the page scrolls.
      const speeds = [-190, 230, -150]
      gsap.utils.toArray('[data-drift-row]', scope).forEach((row, index) => {
        gsap.fromTo(
          row,
          { x: -speeds[index] / 2 },
          {
            x: speeds[index] / 2,
            ease: 'none',
            scrollTrigger: { trigger: scope, start: 'top bottom', end: 'bottom top', scrub: 1 },
          },
        )
      })

      // The collapse: the scatter contracts and the single record resolves.
      const resolve = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '[data-resolve]',
          start: 'top 85%',
          end: 'top 40%',
          scrub: 0.7,
        },
      })
      resolve
        .fromTo('[data-scatter]', { opacity: 1 }, { opacity: 0.32, duration: 1 }, 0)
        .fromTo('[data-scatter]', { scale: 1 }, { scale: 0.96, duration: 1 }, 0)
        .fromTo('[data-converge]', { opacity: 0, y: 28, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 1 }, 0.15)
        .fromTo('[data-converge-row]', { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.18 }, 0.4)
    }, root)

    return () => context.revert()
  }, [])

  return (
    <section ref={root} id="problem" className="relative overflow-hidden border-t border-line bg-surface py-20 lg:py-28">
      <div className="mx-auto w-full max-w-[1400px] px-6 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-tiny font-medium text-muted" data-wipe>
            The problem
          </p>
          <h2 className="mt-3 font-display text-h1 leading-[1.08] text-ink">
            <span className="block" data-wipe>
              A project generates thousands
            </span>
            <span className="block" data-wipe>
              of numbers a week. Almost none
            </span>
            <span className="block" data-wipe>
              end up anywhere you can use.
            </span>
          </h2>
          <p className="mt-5 max-w-xl text-lead text-muted">
            Construction data is not missing. It is scattered, and by the time anyone
            collects it into one view, the decision it would have informed has already
            been made.
          </p>
        </div>
      </div>

      {/* The scatter. Full-bleed so the rows run off both edges. */}
      <div data-scatter className="mt-14 space-y-3">
        {ROWS.map((row, rowIndex) => (
          <div key={rowIndex} data-drift-row className="flex w-max gap-3 px-6">
            {/* Doubled so the row still fills the viewport at either extreme
                of its drift. */}
            {[...row, ...row, ...row].map(([source, detail], index) => (
              <article
                key={`${source}-${index}`}
                className={cn(
                  'flex w-[17rem] shrink-0 items-start gap-3 rounded-panel border border-line bg-paper px-4 py-3',
                  rowIndex === 1 && 'bg-surface',
                )}
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-ink">{source}</span>
                  <span className="block truncate text-tiny text-muted">{detail}</span>
                </span>
              </article>
            ))}
          </div>
        ))}
      </div>

      {/* The resolution. */}
      <div data-resolve className="mx-auto mt-14 w-full max-w-[1400px] px-6 lg:px-10">
        <div className="flex justify-center">
          <ArrowDown size={18} className="text-line-strong" />
        </div>

        <div
          data-converge
          className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-panel border border-line bg-surface shadow-overlay"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="panel-title">One record per project</p>
            <span className="text-micro text-subtle">keyed, current, queryable</span>
          </div>
          <ul className="divide-y divide-line">
            {[
              ['Progress', 'Built from every site report filed, not from a monthly summary'],
              ['Cost', 'Committed spend against the value of work actually delivered'],
              ['Materials', 'Consumption measured against each supplier’s lead time'],
              ['Documents', 'BOQs and invoices read on upload into structured rows'],
            ].map(([label, detail]) => (
              <li key={label} data-converge-row className="flex items-start gap-3 px-5 py-3.5">
                <Check size={14} className="mt-0.5 shrink-0 text-healthy" strokeWidth={2.5} />
                <span className="min-w-0">
                  <span className="block text-base font-medium text-ink">{label}</span>
                  <span className="block text-tiny leading-relaxed text-muted">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
