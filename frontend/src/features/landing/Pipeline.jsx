import { useLayoutEffect, useRef } from 'react'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'
import { gsap, has } from './scroll'

/**
 * Collect, organise, analyse, predict, act — as a horizontal track the visitor
 * scrolls through.
 *
 * The section pins and the stages travel sideways, so moving through the
 * pipeline is the same gesture as reading it. Each stage carries a small
 * diagram that draws itself as that stage arrives, using ScrollTrigger's
 * containerAnimation so the diagrams key off horizontal position rather than
 * page position.
 */

const STAGES = [
  {
    key: 'collect',
    label: 'Collect',
    title: 'Everything arrives in one place',
    body:
      'Site reports, BOQs, invoices, material challans and progress photos land against the project they belong to, from the phone in someone’s hand at the gate.',
    Diagram: CollectDiagram,
  },
  {
    key: 'organise',
    label: 'Organise',
    title: 'Keyed, not filed',
    body:
      'A quantity becomes a row with a unit, a rate and a vendor. A pour becomes a date against a phase. Nothing sits in a folder waiting to be read by a person.',
    Diagram: OrganiseDiagram,
  },
  {
    key: 'analyse',
    label: 'Analyse',
    title: 'Plan against reality',
    body:
      'Progress from tasks measured against the contract programme, and committed spend against the value of work delivered. The gap between the two is the finding.',
    Diagram: AnalyseDiagram,
  },
  {
    key: 'predict',
    label: 'Predict',
    title: 'Where the current rate lands',
    body:
      'The recent rate of build, fitted from the last twelve site reports, extended forward. A completion date, a forecast cost, and the day stock runs dry.',
    Diagram: PredictDiagram,
  },
  {
    key: 'act',
    label: 'Act',
    title: 'One decision, made in time',
    body:
      'Raise the purchase order before the lead time bites. Add the second shift while it still recovers the programme. The point of the data is the decision.',
    Diagram: ActDiagram,
  },
]

export function Pipeline() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    if (prefersReducedMotion()) {
      gsap.set(gsap.utils.toArray('[data-draw], [data-stage-in]', scope), {
        opacity: 1,
        strokeDashoffset: 0,
        y: 0,
        x: 0,
      })
      return undefined
    }

    const context = gsap.context(() => {
      const track = scope.querySelector('[data-track]')
      const panels = gsap.utils.toArray('[data-panel]', scope)
      const distance = () => Math.max(0, track.scrollWidth - scope.offsetWidth)

      // The track itself. Everything else keys off this tween.
      const horizontal = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          end: () => `+=${distance() + window.innerHeight * 0.75}`,
          pin: true,
          scrub: 0.55,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // Progress read-out for the pinned section.
      gsap.to('[data-pipeline-rail]', {
        scaleX: 1,
        ease: 'none',
        transformOrigin: 'left center',
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          end: () => `+=${distance() + window.innerHeight * 0.75}`,
          scrub: 0.4,
        },
      })

      // Per-stage reveals, driven by horizontal position inside the track.
      panels.forEach((panel) => {
        const timeline = gsap.timeline({
          defaults: { ease: 'power2.out' },
          scrollTrigger: {
            trigger: panel,
            containerAnimation: horizontal,
            start: 'left 95%',
            end: 'center 58%',
            scrub: 0.6,
          },
        })

        // Stages differ in which parts they have, so each tween is added only
        // when its targets are present.
        const part = (selector) => panel.querySelectorAll(selector)
        const add = (selector, from, to, at) => {
          const targets = part(selector)
          if (has(targets)) timeline.fromTo(targets, from, to, at)
        }

        add('[data-stage-in]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 1, stagger: 0.25 }, 0)
        add('[data-slide]', { opacity: 0, x: -22 }, { opacity: 1, x: 0, duration: 1, stagger: 0.18 }, 0.35)
        add(
          '[data-draw]',
          { strokeDashoffset: 1 },
          { strokeDashoffset: 0, duration: 1.2, stagger: 0.08, ease: 'none' },
          0.2,
        )
        add('[data-pop]', { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.8, stagger: 0.16 }, 0.8)
      })
    }, root)

    return () => context.revert()
  }, [])

  return (
    <section ref={root} id="pipeline" className="relative overflow-hidden border-t border-line bg-paper">
      {/* pt-14 clears the sticky nav, which sits above the pinned section. */}
      <div className="flex h-screen min-h-[620px] flex-col justify-center pb-10 pt-[4.5rem]">
        {/* Section heading stays put while the stages travel past it. */}
        <div className="mx-auto w-full max-w-[1400px] shrink-0 px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-tiny font-medium text-amber-deep">How it works</p>
              <h2 className="mt-2.5 max-w-xl font-display text-h1 leading-[1.08] text-ink">
                Five steps from the gate register to a decision.
              </h2>
            </div>
            <p className="max-w-xs text-tiny leading-relaxed text-muted">
              Keep scrolling. The pipeline moves sideways so you read it the way the
              data travels through it.
            </p>
          </div>

          <div className="mt-7 h-px w-full bg-line">
            <div
              data-pipeline-rail
              className="h-px origin-left bg-amber"
              style={{ transform: 'scaleX(0)' }}
              aria-hidden
            />
          </div>
        </div>

        {/* The track fills whatever height is left, so there is no dead band
            between the heading and the stages. */}
        <div className="mt-7 shrink-0">
          <div data-track className="flex w-max items-stretch gap-4 px-6 lg:gap-5 lg:px-10">
            {STAGES.map((stage, index) => (
              <article
                key={stage.key}
                data-panel
                className={cn(
                  'flex w-[min(86vw,30rem)] flex-col justify-between rounded-panel border border-line bg-surface p-6',
                  'h-[min(56vh,25rem)]',
                )}
              >
                <div>
                  <div className="flex items-center gap-2.5" data-stage-in>
                    <span className="font-display text-tiny font-semibold tabular text-amber-deep">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="h-px w-5 bg-line-strong" aria-hidden />
                    <span className="text-tiny font-medium text-muted">{stage.label}</span>
                  </div>
                  <h3 className="mt-3.5 font-display text-h3 leading-tight text-ink" data-stage-in>
                    {stage.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted" data-stage-in>
                    {stage.body}
                  </p>
                </div>

                <div className="mt-6 rounded-control border border-line bg-raised/45 p-3">
                  <stage.Diagram />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Stage diagrams
   Each one draws the actual mechanism of its stage. Paths carry pathLength=1
   so the dash offset can be animated in 0..1 units without measuring them.
   -------------------------------------------------------------------------- */

const SVG = 'h-[104px] w-full'

function CollectDiagram() {
  return (
    <svg viewBox="0 0 260 104" className={SVG} aria-hidden>
      {/* Sources sliding in from the left */}
      {[0, 1, 2].map((index) => (
        <g key={index} data-slide>
          <rect
            x={6}
            y={14 + index * 26}
            width={54}
            height={20}
            rx={3}
            className="fill-surface stroke-line-strong"
            strokeWidth="1.2"
          />
          <line x1={13} y1={21 + index * 26} x2={44} y2={21 + index * 26} className="stroke-line-strong" strokeWidth="1.4" />
          <line x1={13} y1={27 + index * 26} x2={36} y2={27 + index * 26} className="stroke-line" strokeWidth="1.4" />
        </g>
      ))}

      {/* Their routes converging on the record */}
      {[24, 50, 76].map((y, index) => (
        <path
          key={y}
          data-draw
          pathLength={1}
          strokeDasharray={1}
          d={`M62 ${y} C 104 ${y}, 118 52, 158 52`}
          className="stroke-amber"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      ))}

      {/* The project record */}
      <rect x={160} y={26} width={94} height={52} rx={5} className="fill-surface stroke-ink" strokeWidth="1.5" data-pop />
      <line x1={160} y1={42} x2={254} y2={42} className="stroke-line" strokeWidth="1.2" data-pop />
      <text x={170} y={38} className="fill-ink" fontSize="8.5" fontWeight="600" data-pop>SKY-01</text>
      {[52, 61, 70].map((y) => (
        <line key={y} x1={170} y1={y} x2={244} y2={y} className="stroke-line-strong" strokeWidth="1.3" data-pop />
      ))}
    </svg>
  )
}

function OrganiseDiagram() {
  const rows = [0, 1, 2, 3]
  return (
    <svg viewBox="0 0 260 104" className={SVG} aria-hidden>
      {/* Header of the structured table */}
      <g data-stage-in>
        <line x1={8} y1={18} x2={252} y2={18} className="stroke-line-strong" strokeWidth="1.2" />
        {[8, 118, 170, 212].map((x, index) => (
          <text key={x} x={x} y={13} className="fill-subtle" fontSize="7">
            {['ITEM', 'QTY', 'RATE', 'VENDOR'][index]}
          </text>
        ))}
      </g>

      {/* Values snapping into their columns */}
      {rows.map((row) => (
        <g key={row} data-slide>
          <rect x={8} y={24 + row * 19} width={96} height={11} rx={2} className="fill-line-strong" opacity="0.5" />
          <rect x={118} y={24 + row * 19} width={38} height={11} rx={2} className="fill-amber" opacity="0.75" />
          <rect x={170} y={24 + row * 19} width={32} height={11} rx={2} className="fill-line-strong" opacity="0.5" />
          <rect x={212} y={24 + row * 19} width={40} height={11} rx={2} className="fill-line-strong" opacity="0.5" />
          <line x1={8} y1={39 + row * 19} x2={252} y2={39 + row * 19} className="stroke-line" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}

function AnalyseDiagram() {
  return (
    <svg viewBox="0 0 260 104" className={SVG} aria-hidden>
      {/* Grid */}
      {[22, 44, 66, 88].map((y) => (
        <line key={y} x1={8} y1={y} x2={252} y2={y} className="stroke-line" strokeWidth="1" />
      ))}

      {/* Planned: the benchmark */}
      <path
        data-draw
        pathLength={1}
        strokeDasharray={1}
        d="M12 86 C 70 74, 140 46, 248 20"
        className="stroke-amber"
        strokeWidth="1.8"
        fill="none"
      />
      {/* Actual: what the site built */}
      <path
        data-draw
        pathLength={1}
        strokeDasharray={1}
        d="M12 88 C 70 82, 140 68, 248 54"
        className="stroke-ink"
        strokeWidth="2.2"
        fill="none"
      />

      {/* The gap, which is the whole analysis */}
      <g data-pop>
        <line x1={230} y1={22} x2={230} y2={54} className="stroke-critical" strokeWidth="1.4" />
        <line x1={225} y1={22} x2={235} y2={22} className="stroke-critical" strokeWidth="1.4" />
        <line x1={225} y1={54} x2={235} y2={54} className="stroke-critical" strokeWidth="1.4" />
        <text x={222} y={72} className="fill-critical" fontSize="8" fontWeight="600" textAnchor="end">
          −16.7 pts
        </text>
      </g>
    </svg>
  )
}

function PredictDiagram() {
  return (
    <svg viewBox="0 0 260 104" className={SVG} aria-hidden>
      {[22, 44, 66, 88].map((y) => (
        <line key={y} x1={8} y1={y} x2={252} y2={y} className="stroke-line" strokeWidth="1" />
      ))}

      {/* Contract completion date */}
      <g data-stage-in>
        <line x1={168} y1={10} x2={168} y2={94} className="stroke-line-strong" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x={164} y={101} className="fill-subtle" fontSize="7" textAnchor="end">deadline</text>
      </g>

      {/* Observed rate */}
      <path
        data-draw
        pathLength={1}
        strokeDasharray={1}
        d="M12 88 C 60 82, 108 72, 150 64"
        className="stroke-ink"
        strokeWidth="2.2"
        fill="none"
      />
      {/* Extrapolated forward, which is the prediction */}
      <path
        data-draw
        pathLength={1}
        strokeDasharray={1}
        d="M150 64 C 190 56, 220 44, 248 34"
        className="stroke-critical"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />

      <g data-pop>
        <circle cx={248} cy={34} r={3.2} className="fill-critical" />
        <text x={244} y={26} className="fill-critical" fontSize="8" fontWeight="600" textAnchor="end">
          +308 days
        </text>
      </g>
    </svg>
  )
}

function ActDiagram() {
  return (
    <svg viewBox="0 0 260 104" className={SVG} aria-hidden>
      {/* The two actions the finding recommends */}
      {[
        ['Raise PO — TMT steel', 'before 20 Sep'],
        ['Add second shift — structure', 'from Monday'],
      ].map(([title, when], index) => (
        <g key={title} data-slide>
          <rect
            x={8}
            y={12 + index * 40}
            width={244}
            height={32}
            rx={4}
            className="fill-surface stroke-line-strong"
            strokeWidth="1.2"
          />
          <rect x={8} y={12 + index * 40} width={3} height={32} className="fill-amber" />
          <text x={22} y={26 + index * 40} className="fill-ink" fontSize="9" fontWeight="600">{title}</text>
          <text x={22} y={37 + index * 40} className="fill-muted" fontSize="7.5">{when}</text>

          {/* The tick lands last: the decision is made */}
          <g data-pop>
            <circle cx={236} cy={28 + index * 40} r={8} className="fill-healthy" opacity="0.14" />
            <path
              d={`M232 ${28 + index * 40} l3 3 l6 -6`}
              className="stroke-healthy"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </g>
      ))}
    </svg>
  )
}
