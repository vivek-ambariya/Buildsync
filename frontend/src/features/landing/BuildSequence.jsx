import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'

gsap.registerPlugin(ScrollTrigger)

const FLOORS = 13
const GROUND = 424
const FLOOR_HEIGHT = 25
const BUILDING_LEFT = 302
const BUILDING_WIDTH = 196

/** Scroll position at which each stage of the build takes over the caption. */
const STAGES = [
  {
    key: 'foundation',
    label: 'Foundation',
    title: 'It starts on the ground',
    body:
      'Excavation depth, raft pours, cube test results. The first numbers a project generates arrive as paper and WhatsApp photos, and that is where the record usually ends.',
  },
  {
    key: 'structure',
    label: 'Structure',
    title: 'Thirteen floors, thirteen versions of the truth',
    body:
      'Every slab is a date, a tonnage and a labour bill. Track them in one place and the rate of build becomes a number you can forecast from.',
  },
  {
    key: 'facade',
    label: 'Envelope',
    title: 'Where the budget quietly goes',
    body:
      'Glazing and finishes carry the longest lead times and the largest invoices. BuildSync watches consumption against supplier lead time, not against a calendar.',
  },
  {
    key: 'handover',
    label: 'Handover',
    title: 'Finished is a measurement, not a feeling',
    body:
      'Snag lists close, retention releases, and the project stops being a site and becomes a record you can learn from.',
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    title: 'And now it is data',
    body:
      'The same tower, read as progress against plan. Sixteen points behind, a forecast that lands ten months late, and the one phase responsible for it.',
  },
]

/**
 * A scroll-scrubbed construction sequence.
 *
 * The stage is pinned and the whole build is one timeline tied to scroll
 * position, so the visitor is scrubbing the construction rather than
 * triggering canned animations. The last beat redraws the finished tower as
 * the product's own progress chart, which is the argument the page is making.
 */
export function BuildSequence() {
  const root = useRef(null)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    // With reduced motion the sequence is shown resolved, with no pinning.
    if (prefersReducedMotion()) {
      gsap.set(scope.querySelectorAll('[data-floor], .raft, .facade, .window-lit, .data-layer, .caption'), {
        opacity: 1,
        scaleY: 1,
      })
      return undefined
    }

    const context = gsap.context(() => {
      const floors = gsap.utils.toArray('[data-floor]', scope)

      gsap.set(floors, { transformOrigin: 'bottom center', scaleY: 0, opacity: 0 })
      gsap.set('.raft', { scaleX: 0, transformOrigin: 'center center' })
      gsap.set('.pit', { opacity: 0 })
      gsap.set('.facade', { opacity: 0 })
      gsap.set('.window-lit', { opacity: 0 })
      gsap.set('.data-layer', { opacity: 0 })
      gsap.set('.crane', { opacity: 0, y: 18 })
      gsap.set('.truck', { x: -260 })
      gsap.set('.caption', { opacity: 0, y: 16 })
      gsap.set('.caption-0', { opacity: 1, y: 0 })

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: scope,
          start: 'top top',
          end: '+=340%',
          pin: '.stage',
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      })

      // Every tween is placed at an explicit time on one shared schedule, so
      // the captions and the drawing can never drift apart. Letting GSAP
      // auto-place labels puts them wherever the previous tween happened to
      // end, which is not something the copy can be written against.
      const AT = { foundation: 0, structure: 2, facade: 8, handover: 10.5, data: 12.5, hold: 15.5 }

      // --- Foundation: break ground, set the crane, steel arrives ---------
      timeline
        .to('.pit', { opacity: 1, duration: 0.5 }, 0)
        .to('.ground-fill', { opacity: 1, duration: 0.5 }, 0)
        .to('.raft', { scaleX: 1, duration: 0.7, ease: 'power2.out' }, 0.5)
        .to('.crane', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.9)
        .to('.truck', { x: 0, duration: 0.9, ease: 'power1.out' }, 1)

      // --- Structure: floors stack while the crane works above them -------
      const STRUCTURE_SPAN = AT.facade - AT.structure
      timeline.to('[data-floor]', {
        scaleY: 1,
        opacity: 1,
        duration: 0.5,
        stagger: (STRUCTURE_SPAN - 0.5) / (FLOORS - 1),
        ease: 'power2.out',
      }, AT.structure)

      // The trolley tracks out along the jib and the hook climbs with the
      // tower, so the crane is visibly placing the floors as they appear.
      timeline.to('.trolley', { x: 128, duration: STRUCTURE_SPAN - 0.2, ease: 'power1.inOut' }, AT.structure)
      timeline.to('.hook-group', {
        y: -FLOORS * FLOOR_HEIGHT * 0.82,
        duration: STRUCTURE_SPAN - 0.2,
        ease: 'power1.inOut',
      }, AT.structure)
      timeline.to('.payload', {
        y: '-=7',
        duration: 0.45,
        repeat: Math.round(STRUCTURE_SPAN / 0.45) - 1,
        yoyo: true,
        ease: 'sine.inOut',
      }, AT.structure)
      timeline.to('.truck', { x: 300, duration: 1.2, ease: 'power1.in' }, AT.structure + 3.4)

      // --- Envelope -------------------------------------------------------
      const FACADE_SPAN = AT.handover - AT.facade
      timeline.to('.facade', {
        opacity: 1,
        duration: 0.4,
        stagger: (FACADE_SPAN - 0.7) / (FLOORS - 1),
      }, AT.facade)
      timeline.to('.sky-warm', { opacity: 1, duration: 1.5 }, AT.facade)

      // --- Handover: the building is occupied, the crane comes down -------
      // A deterministic scatter: the same bays light every time, so the
      // finished frame is composed rather than different on each visit.
      const LIT = [0, 0.8, 0, 0.55, 0.85, 0, 0.35, 0.75, 0, 0, 0.7, 0.45]
      timeline.to('.window-lit', {
        opacity: (index) => LIT[index % LIT.length],
        duration: 0.3,
        stagger: { each: 0.03, from: 'random' },
      }, AT.handover)
      timeline.to('.crane', { opacity: 0, y: 24, duration: 0.9, ease: 'power2.in' }, AT.handover + 0.7)

      // --- Intelligence: the same tower, read as a progress chart ---------
      timeline.to('.building-group', { x: -46, duration: 1, ease: 'power2.inOut' }, AT.data)
      timeline.to('.site-context', { opacity: 0.22, duration: 0.8 }, AT.data)
      timeline.to('.data-layer', { opacity: 1, duration: 0.7, stagger: 0.35 }, AT.data + 0.5)
      timeline.to('.variance-floors', { opacity: 1, duration: 0.6 }, AT.data + 1.1)

      // A beat of stillness on the finished reading before the pin releases.
      timeline.to({}, { duration: 1 }, AT.hold)

      // --- Captions: each one holds while its own stage is being built ----
      const CAPTION_AT = [AT.foundation, AT.structure, AT.facade, AT.handover, AT.data]
      CAPTION_AT.forEach((time, index) => {
        if (index === 0) return
        timeline.to(`.caption-${index - 1}`, { opacity: 0, y: -14, duration: 0.45 }, time - 0.45)
        timeline.to(`.caption-${index}`, { opacity: 1, y: 0, duration: 0.55 }, time)
      })

      timeline.to('.stage-rail', { scaleX: 1, duration: AT.hold + 1, ease: 'none' }, 0)
    }, root)

    return () => context.revert()
  }, [])

  const floors = Array.from({ length: FLOORS }, (_, index) => index)

  return (
    <section ref={root} className="relative" aria-label="How a project becomes data">
      <div className="stage relative flex h-screen min-h-[600px] items-center overflow-hidden border-y border-line bg-surface">
        <div className="survey-grid absolute inset-0" aria-hidden />

        <div className="relative mx-auto grid w-full max-w-[1320px] items-center gap-6 px-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-14 lg:px-10">
          {/* Captions */}
          <div className="relative order-2 min-h-[13rem] lg:order-1">
            {STAGES.map((stage, index) => (
              <div
                key={stage.key}
                className={cn('caption', `caption-${index}`, index > 0 && 'absolute inset-0')}
              >
                <p className="text-tiny font-medium text-amber-deep">{stage.label}</p>
                <h3 className="mt-2.5 font-display text-h2 leading-[1.1] text-ink">{stage.title}</h3>
                <p className="mt-3.5 max-w-sm text-lead text-muted">{stage.body}</p>
              </div>
            ))}

            <div className="mt-8 hidden h-px w-full max-w-sm bg-line lg:block">
              <div
                className="stage-rail h-px origin-left bg-amber"
                style={{ transform: 'scaleX(0)' }}
                aria-hidden
              />
            </div>
          </div>

          {/* The site */}
          <div className="order-1 flex items-center justify-center lg:order-2">
            <svg
              viewBox="0 0 760 500"
              preserveAspectRatio="xMidYMid meet"
              className="h-[min(56vh,440px)] w-full max-w-[680px]"
              role="img"
              aria-label="A tower under construction, resolving into a progress chart"
            >
              <defs>
                <linearGradient id="sky-warm-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--amber))" stopOpacity="0" />
                  <stop offset="45%" stopColor="rgb(var(--amber))" stopOpacity="0.11" />
                  <stop offset="100%" stopColor="rgb(var(--amber))" stopOpacity="0" />
                </linearGradient>
                <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--ink))" strokeOpacity="0.16" strokeWidth="1.2" />
                </pattern>
              </defs>

              <rect className="sky-warm opacity-0" x="0" y="0" width="760" height={GROUND} fill="url(#sky-warm-grad)" />

              <g className="site-context">
                {/* Ground and excavation */}
                <line x1="0" y1={GROUND} x2="760" y2={GROUND} className="stroke-line-strong" strokeWidth="1.5" />
                <rect className="ground-fill opacity-0" x="0" y={GROUND} width="760" height="76" fill="url(#hatch)" />
                <path
                  className="pit stroke-line-strong"
                  d={`M${BUILDING_LEFT - 26} ${GROUND} L${BUILDING_LEFT - 14} ${GROUND + 22} L${BUILDING_LEFT + BUILDING_WIDTH + 14} ${GROUND + 22} L${BUILDING_LEFT + BUILDING_WIDTH + 26} ${GROUND}`}
                  fill="none"
                  strokeWidth="1.5"
                  strokeDasharray="5 4"
                />

                {/* Tower crane */}
                <g className="crane">
                  <line x1="176" y1={GROUND} x2="176" y2="74" className="stroke-ink" strokeWidth="3" />
                  {Array.from({ length: 9 }, (_, index) => (
                    <line
                      key={index}
                      x1="168"
                      y1={GROUND - index * 40}
                      x2="184"
                      y2={GROUND - (index + 1) * 40}
                      className="stroke-ink"
                      strokeWidth="1"
                      strokeOpacity="0.45"
                    />
                  ))}
                  <line x1="120" y1="74" x2="560" y2="74" className="stroke-ink" strokeWidth="3" />
                  <line x1="176" y1="52" x2="120" y2="74" className="stroke-ink" strokeWidth="1.2" strokeOpacity="0.5" />
                  <line x1="176" y1="52" x2="420" y2="74" className="stroke-ink" strokeWidth="1.2" strokeOpacity="0.5" />
                  <rect x="112" y="66" width="18" height="16" className="fill-ink" rx="2" />

                  <g className="trolley">
                    <rect x="268" y="68" width="16" height="9" className="fill-ink" rx="1.5" />
                    <g className="hook-group">
                      <line x1="276" y1="77" x2="276" y2="404" className="stroke-ink" strokeWidth="1" strokeOpacity="0.6" />
                      <g className="payload">
                        <rect x="252" y="404" width="48" height="9" className="fill-amber" rx="1.5" />
                        <rect x="256" y="398" width="40" height="5" className="fill-amber-deep" rx="1" opacity="0.7" />
                      </g>
                    </g>
                  </g>
                </g>

                {/* Steel delivery */}
                <g className="truck">
                  <rect x="560" y={GROUND - 30} width="74" height="20" className="fill-surface stroke-ink" strokeWidth="1.5" rx="2" />
                  <rect x="566" y={GROUND - 38} width="30" height="10" className="fill-amber" rx="1" />
                  <rect x="634" y={GROUND - 40} width="30" height="30" className="fill-ink" rx="2" />
                  <circle cx="580" cy={GROUND - 7} r="7" className="fill-ink" />
                  <circle cx="614" cy={GROUND - 7} r="7" className="fill-ink" />
                  <circle cx="650" cy={GROUND - 7} r="7" className="fill-ink" />
                </g>
              </g>

              {/* The tower */}
              <g className="building-group">
                <rect
                  className="raft fill-ink"
                  x={BUILDING_LEFT - 14}
                  y={GROUND}
                  width={BUILDING_WIDTH + 28}
                  height="14"
                  rx="1"
                />

                {floors.map((index) => {
                  const y = GROUND - (index + 1) * FLOOR_HEIGHT
                  return (
                    <g key={index} data-floor={index}>
                      <rect
                        x={BUILDING_LEFT}
                        y={y}
                        width={BUILDING_WIDTH}
                        height={FLOOR_HEIGHT}
                        className="fill-surface stroke-ink"
                        strokeWidth="1.4"
                      />
                      {/* Columns */}
                      {[0.25, 0.5, 0.75].map((fraction) => (
                        <line
                          key={fraction}
                          x1={BUILDING_LEFT + BUILDING_WIDTH * fraction}
                          y1={y}
                          x2={BUILDING_LEFT + BUILDING_WIDTH * fraction}
                          y2={y + FLOOR_HEIGHT}
                          className="stroke-line-strong"
                          strokeWidth="1"
                        />
                      ))}
                      {/* Glazing, revealed in the envelope stage */}
                      <rect
                        className="facade fill-info"
                        x={BUILDING_LEFT + 3}
                        y={y + 4}
                        width={BUILDING_WIDTH - 6}
                        height={FLOOR_HEIGHT - 8}
                        fillOpacity="0.09"
                      />
                      {/* Lights. Only some bays end up lit, which is what a
                          finished building at dusk actually looks like. */}
                      {[0.07, 0.3, 0.53, 0.76].map((fraction) => (
                        <rect
                          key={fraction}
                          className="window-lit fill-amber"
                          x={BUILDING_LEFT + BUILDING_WIDTH * fraction + 6}
                          y={y + 8}
                          width={BUILDING_WIDTH * 0.115}
                          height={FLOOR_HEIGHT - 15}
                          rx="0.5"
                        />
                      ))}
                    </g>
                  )
                })}

                {/* Floors carrying the variance, marked once the data lands */}
                <rect
                  className="variance-floors fill-critical opacity-0"
                  x={BUILDING_LEFT}
                  y={GROUND - FLOORS * FLOOR_HEIGHT}
                  width={BUILDING_WIDTH}
                  height={FLOOR_HEIGHT * 2}
                  opacity="0"
                  fillOpacity="0.14"
                />
              </g>

              {/* The data reading of the same tower */}
              <g className="data-overlay">
                <g className="data-layer">
                  {/* Where the programme says the build should be */}
                  <line
                    x1={BUILDING_LEFT - 92}
                    y1={GROUND - FLOORS * FLOOR_HEIGHT}
                    x2="596"
                    y2={GROUND - FLOORS * FLOOR_HEIGHT}
                    className="stroke-amber"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                  <text
                    x="590"
                    y={GROUND - FLOORS * FLOOR_HEIGHT - 8}
                    className="fill-amber-deep"
                    fontSize="11"
                    textAnchor="end"
                  >
                    planned 56.6%
                  </text>
                </g>

                <g className="data-layer">
                  {/* Where it actually is */}
                  <line
                    x1={BUILDING_LEFT - 92}
                    y1={GROUND - (FLOORS - 2) * FLOOR_HEIGHT}
                    x2="596"
                    y2={GROUND - (FLOORS - 2) * FLOOR_HEIGHT}
                    className="stroke-ink"
                    strokeWidth="2"
                  />
                  <text
                    x="590"
                    y={GROUND - (FLOORS - 2) * FLOOR_HEIGHT + 16}
                    className="fill-ink"
                    fontSize="11"
                    textAnchor="end"
                  >
                    actual 40.0%
                  </text>
                </g>

                <g className="data-layer">
                  {/* The gap between the two, which is the whole product */}
                  <line x1="612" y1={GROUND - FLOORS * FLOOR_HEIGHT} x2="612" y2={GROUND - (FLOORS - 2) * FLOOR_HEIGHT} className="stroke-critical" strokeWidth="1.5" />
                  <line x1="606" y1={GROUND - FLOORS * FLOOR_HEIGHT} x2="618" y2={GROUND - FLOORS * FLOOR_HEIGHT} className="stroke-critical" strokeWidth="1.5" />
                  <line x1="606" y1={GROUND - (FLOORS - 2) * FLOOR_HEIGHT} x2="618" y2={GROUND - (FLOORS - 2) * FLOOR_HEIGHT} className="stroke-critical" strokeWidth="1.5" />
                  <text x="626" y={GROUND - (FLOORS - 1) * FLOOR_HEIGHT + 4} className="fill-critical" fontSize="12" fontWeight="600">
                    −16.6 pts
                  </text>
                </g>

                <g className="data-layer">
                  {/* The finding, pointing at the phase responsible for it */}
                  <line x1="172" y1="300" x2={BUILDING_LEFT - 52} y2="300" className="stroke-critical" strokeWidth="1.2" strokeDasharray="4 3" />
                  <circle cx={BUILDING_LEFT - 50} cy="300" r="3" className="fill-critical" />
                  <rect x="14" y="272" width="158" height="56" rx="6" className="fill-surface stroke-critical" strokeWidth="1.2" />
                  <text x="28" y="290" className="fill-critical" fontSize="9.5" fontWeight="700" letterSpacing="0.4">HIGH · SCHEDULE</text>
                  <text x="28" y="306" className="fill-ink" fontSize="11.5" fontWeight="600">Structure phase</text>
                  <text x="28" y="320" className="fill-muted" fontSize="9.5">forecast 308 days late</text>
                </g>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  )
}
