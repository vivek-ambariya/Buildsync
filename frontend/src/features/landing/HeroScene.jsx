import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'
import { gsap } from './scroll'

/**
 * A looping three-act scene: the site, the room, then the money.
 *
 * Act one is a worker building a floor. Act two is the project review where
 * what he built becomes a number someone decides on. Act three is that
 * decision reaching the investor, who releases the tranche that pays for the
 * next floor — which is what puts the worker back on site in act one. The loop
 * is a cycle rather than a sequence, which is why it sits in the hero rather
 * than a screenshot.
 *
 * The loop runs on its own clock — it is the one piece of non-scroll motion on
 * the page, and it is here because the story is a sequence, not a state.
 * Figures are drawn as flat geometric pictograms rather than illustration, so
 * they sit inside the same drawing language as the rest of the interface.
 */

const ACTS = [
  { key: 'site', time: '07:40', label: 'On site', caption: 'A slab is poured. Steel goes in. Someone counts the crew.' },
  { key: 'room', time: '09:15', label: 'Project review', caption: 'The same day, read as progress, spend and a decision.' },
  { key: 'capital', time: '11:30', label: 'Funding release', caption: 'The investor sees the same day. The tranche goes out, and the next floor is paid for.' },
]

const ACT_SECONDS = 5.4
const FADE = 0.7

export function HeroScene() {
  const root = useRef(null)
  const [act, setAct] = useState(0)

  useLayoutEffect(() => {
    const scope = root.current
    if (!scope) return undefined

    if (prefersReducedMotion()) {
      gsap.set('[data-act="site"]', { opacity: 1 })
      gsap.set('[data-act="room"], [data-act="capital"]', { opacity: 0 })
      return undefined
    }

    const context = gsap.context(() => {
      gsap.set('[data-act="site"]', { opacity: 1 })
      gsap.set('[data-act="room"], [data-act="capital"]', { opacity: 0, y: 14 })

      // The review's own opening: the chart fills in and the finding surfaces.
      // Run once per visit to the room rather than oscillating, so the screen
      // reads as a chart for most of the act instead of a row of stubs.
      const review = gsap
        .timeline({ paused: true })
        .fromTo(
          '[data-screen-bar]',
          { scaleY: 0.08, transformOrigin: 'bottom center' },
          { scaleY: 1, duration: 0.55, stagger: 0.13, ease: 'power2.out' },
        )
        .fromTo(
          '[data-screen-alert]',
          { opacity: 0, scale: 0.82, transformOrigin: 'center' },
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' },
          '+=0.25',
        )
      gsap.set('[data-screen-bar]', { scaleY: 0.08, transformOrigin: 'bottom center' })
      gsap.set('[data-screen-alert]', { opacity: 0 })

      // The release: each bundle that lands pays for a floor, and the tranche
      // is marked funded once the last one is in. Like the review, it plays
      // once per visit so the act ends on the outcome rather than mid-transfer.
      const release = gsap
        .timeline({ paused: true })
        .fromTo(
          '[data-funded-floor]',
          { opacity: 0, scaleY: 0.15, transformOrigin: 'bottom center' },
          { opacity: 1, scaleY: 1, duration: 0.5, stagger: 1.1, ease: 'power2.out' },
          0.95,
        )
        .fromTo(
          '[data-fund-stamp]',
          { opacity: 0, scale: 0.84, transformOrigin: 'center' },
          { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' },
          '+=0.2',
        )
      gsap.set('[data-funded-floor]', { opacity: 0, scaleY: 0.15, transformOrigin: 'bottom center' })
      gsap.set('[data-fund-stamp]', { opacity: 0 })

      // --- The loop: three acts, cross-fading, forever ------------------
      // Driven off ACTS rather than written out, so the story is edited in one
      // place — the array — rather than in the timeline as well.
      const openings = { room: review, capital: release }
      const loop = gsap.timeline({ repeat: -1 })
      ACTS.forEach((item, index) => {
        const next = ACTS[(index + 1) % ACTS.length]
        loop
          .to({}, { duration: ACT_SECONDS })
          .call(() => {
            setAct((index + 1) % ACTS.length)
            openings[next.key]?.restart()
          })
          .to(`[data-act="${item.key}"]`, { opacity: 0, y: -14, duration: FADE, ease: 'power2.inOut' })
          .to(`[data-act="${next.key}"]`, { opacity: 1, y: 0, duration: FADE, ease: 'power2.out' }, '<0.15')
      })

      // --- Act one: the site keeps working -----------------------------
      // The hammer arm swings from the shoulder.
      gsap.to('[data-hammer-arm]', {
        rotation: -52,
        svgOrigin: '108 200',
        duration: 0.34,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      })
      // A puff of dust each time it lands.
      gsap.fromTo(
        '[data-dust]',
        { opacity: 0.5, scale: 0.4, transformOrigin: 'center' },
        { opacity: 0, scale: 1.9, duration: 0.68, repeat: -1, ease: 'power1.out', stagger: { each: 0.09, repeat: -1 } },
      )
      // The crane lowers a block onto the top floor, then goes back for another.
      gsap.timeline({ repeat: -1, defaults: { ease: 'power1.inOut' } })
        .to('[data-hook]', { y: 84, duration: 1.5 })
        .to('[data-payload]', { opacity: 0, duration: 0.2 }, '>-0.05')
        .to('[data-placed-block]', { opacity: 1, duration: 0.25 }, '<')
        .to('[data-hook]', { y: 0, duration: 1.3 }, '+=0.35')
        .to('[data-placed-block]', { opacity: 0, duration: 0.2 }, '+=0.9')
        .to('[data-payload]', { opacity: 1, duration: 0.2 }, '<')
      // The second worker walks the deck.
      gsap.to('[data-walker]', {
        x: 62,
        duration: 2.6,
        repeat: -1,
        yoyo: true,
        ease: 'none',
      })
      gsap.to('[data-walker-leg]', {
        rotation: 18,
        svgOrigin: '196 156',
        duration: 0.42,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      // --- Act two: the room reads what the site built ------------------
      // The presenter's arm rises to the screen and holds.
      gsap.to('[data-point-arm]', {
        rotation: -34,
        svgOrigin: '250 196',
        duration: 1.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      // Heads turn toward the screen, slightly out of step with each other.
      gsap.to('[data-head]', {
        rotation: 9,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.22, from: 'random' },
        transformOrigin: 'center bottom',
      })

      // --- Act three: the money crosses the gap -------------------------
      // Bundles arc from the investor's hand to the contractor's, one after
      // another. The arc is faked with keyframes rather than a motion path so
      // this stays on the plugins the page already loads.
      gsap.fromTo(
        '[data-note]',
        { x: 0, y: 0, opacity: 0 },
        {
          keyframes: [
            { opacity: 1, duration: 0.12 },
            { x: 32, y: -24, duration: 0.46, ease: 'power1.out' },
            { x: 64, y: 0, duration: 0.46, ease: 'power1.in' },
            { opacity: 0, duration: 0.22 },
          ],
          repeat: -1,
          repeatDelay: 0.6,
          stagger: 0.62,
        },
      )
      // The offered hand and the receiving hand, meeting the transfer.
      gsap.to('[data-offer-arm]', {
        rotation: -7,
        svgOrigin: '113 200',
        duration: 1.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      gsap.to('[data-receive-arm]', {
        rotation: 7,
        svgOrigin: '231 200',
        duration: 1.1,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })

      return () => loop.kill()
    }, root)

    return () => context.revert()
  }, [])

  const current = ACTS[act]

  return (
    <div ref={root} className="overflow-hidden rounded-panel border border-line bg-surface shadow-overlay">
      {/* Which act you are watching, and when it happens. */}
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-tiny font-semibold tabular text-amber-deep">{current.time}</span>
          <span className="h-px w-4 bg-line-strong" aria-hidden />
          <p className="panel-title">{current.label}</p>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {ACTS.map((item, index) => (
            <span
              key={item.key}
              className={cn(
                'block rounded-pill transition-all duration-500 ease-out',
                index === act ? 'h-1 w-5 bg-amber' : 'h-1 w-1.5 bg-line-strong',
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative bg-raised/35">
        <div className="survey-grid absolute inset-0 opacity-70" aria-hidden />
        <svg
          viewBox="0 0 480 300"
          className="relative h-auto w-full"
          role="img"
          aria-label="A worker building a floor on site, then the project review where that day's work is read as data, then the investor releasing the money that pays for the next floor"
        >
          <SiteAct />
          <RoomAct />
          <CapitalAct />
        </svg>
      </div>

      <p className="border-t border-line px-5 py-3 text-tiny leading-relaxed text-muted">
        {current.caption}
      </p>
    </div>
  )
}

/* ==========================================================================
   Act one — the site
   Coordinates are laid out for the frame it is drawn in: the human action
   occupies the lower two thirds, and the record the moment produced sits top
   right, which is the motif both acts share.
   ========================================================================== */

const GROUND = 256

function SiteAct() {
  return (
    <g data-act="site">
      {/* Ground */}
      <line x1={0} y1={GROUND} x2={480} y2={GROUND} className="stroke-line-strong" strokeWidth="1.5" />
      <g className="stroke-ink" strokeWidth="1" opacity="0.13">
        {Array.from({ length: 20 }).map((_, index) => (
          <line key={index} x1={index * 28} y1={GROUND + 2} x2={index * 28 - 14} y2={GROUND + 18} />
        ))}
      </g>

      {/* Tower crane */}
      <g>
        <line x1={52} y1={GROUND} x2={52} y2={74} className="stroke-ink" strokeWidth="3" />
        {Array.from({ length: 5 }).map((_, index) => (
          <line
            key={index}
            x1={46}
            y1={GROUND - index * 37}
            x2={58}
            y2={GROUND - (index + 1) * 37}
            className="stroke-ink"
            strokeWidth="0.9"
            opacity="0.4"
          />
        ))}
        <line x1={24} y1={74} x2={272} y2={74} className="stroke-ink" strokeWidth="3" />
        <line x1={52} y1={54} x2={24} y2={74} className="stroke-ink" strokeWidth="1" opacity="0.5" />
        <line x1={52} y1={54} x2={196} y2={74} className="stroke-ink" strokeWidth="1" opacity="0.5" />
        <rect x={18} y={68} width={14} height={13} rx={2} className="fill-ink" />

        {/* The hook, lowering a block onto the deck being laid */}
        <g data-hook>
          <line x1={228} y1={76} x2={228} y2={112} className="stroke-ink" strokeWidth="1" opacity="0.6" />
          <g data-payload>
            <rect x={208} y={112} width={40} height={14} rx={2} className="fill-amber" />
            <rect x={212} y={105} width={32} height={8} rx={1.5} className="fill-amber-deep" opacity="0.6" />
          </g>
        </g>
      </g>

      {/* The building: three finished floors, one course being laid on top */}
      <g>
        <rect x={152} y={GROUND - 6} width={164} height={12} className="fill-ink" />
        {[0, 1, 2].map((floor) => {
          const y = GROUND - 6 - (floor + 1) * 29
          return (
            <g key={floor}>
              <rect x={160} y={y} width={148} height={29} className="fill-surface stroke-ink" strokeWidth="1.3" />
              {[0.25, 0.5, 0.75].map((fraction) => (
                <line
                  key={fraction}
                  x1={160 + 148 * fraction}
                  y1={y}
                  x2={160 + 148 * fraction}
                  y2={y + 29}
                  className="stroke-line-strong"
                  strokeWidth="1"
                />
              ))}
            </g>
          )
        })}

        {/* The working deck */}
        <rect x={160} y={GROUND - 100} width={148} height={7} className="fill-ink" />

        {/* Blocks already laid, and the one the crane has just set down */}
        {[0, 1, 2].map((index) => (
          <rect
            key={index}
            x={166 + index * 32}
            y={GROUND - 114}
            width={28}
            height={14}
            rx={2}
            className="fill-line-strong"
          />
        ))}
        <rect
          data-placed-block
          x={262}
          y={GROUND - 114}
          width={40}
          height={14}
          rx={2}
          className="fill-amber"
          opacity="0"
        />

        {/* Scaffold on the right elevation */}
        <g className="stroke-line-strong" strokeWidth="1.2">
          <line x1={322} y1={GROUND} x2={322} y2={GROUND - 104} />
          <line x1={344} y1={GROUND} x2={344} y2={GROUND - 104} />
          {[0, 1, 2].map((index) => (
            <g key={index}>
              <line x1={322} y1={GROUND - index * 35} x2={344} y2={GROUND - index * 35} />
              <line x1={322} y1={GROUND - index * 35} x2={344} y2={GROUND - (index + 1) * 35} opacity="0.5" />
            </g>
          ))}
          <line x1={322} y1={GROUND - 104} x2={344} y2={GROUND - 104} />
        </g>
      </g>

      {/* The worker on the ground, hammering. Shoulder at (108, 200). */}
      <g>
        {[0, 1, 2].map((index) => (
          <circle
            key={index}
            data-dust
            cx={84 + index * 6}
            cy={GROUND - 8}
            r={3.6}
            className="fill-line-strong"
            opacity="0"
          />
        ))}

        <line x1={108} y1={GROUND} x2={100} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <line x1={120} y1={GROUND} x2={110} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <rect x={99} y={GROUND - 60} width={19} height={34} rx={6} className="fill-ink" />
        {/* The high-visibility band, which is how you actually spot a worker */}
        <rect x={99} y={GROUND - 50} width={19} height={6} className="fill-amber" />
        <line x1={110} y1={GROUND - 54} x2={124} y2={GROUND - 38} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        <g data-hammer-arm>
          <line x1={108} y1={GROUND - 56} x2={88} y2={GROUND - 24} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
          <rect x={78} y={GROUND - 28} width={16} height={6} rx={2} className="fill-ink" />
        </g>
        <circle cx={108} cy={GROUND - 71} r={9} className="fill-ink" />
        <path d={`M96 ${GROUND - 74} a12 10.5 0 0 1 24 0 z`} className="fill-amber" />
        <line x1={93} y1={GROUND - 74} x2={123} y2={GROUND - 74} className="stroke-amber" strokeWidth="2.8" strokeLinecap="round" />
      </g>

      {/* A second worker walking the deck. Hip at (196, 156). */}
      <g data-walker>
        <line
          data-walker-leg
          x1={196}
          y1={GROUND - 100}
          x2={190}
          y2={GROUND - 124}
          className="stroke-ink"
          strokeWidth="3.8"
          strokeLinecap="round"
        />
        <line x1={204} y1={GROUND - 100} x2={198} y2={GROUND - 124} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        <rect x={188} y={GROUND - 152} width={16} height={30} rx={5} className="fill-ink" />
        <rect x={188} y={GROUND - 143} width={16} height={5} className="fill-amber" />
        <line x1={196} y1={GROUND - 146} x2={210} y2={GROUND - 134} className="stroke-ink" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx={196} cy={GROUND - 161} r={8} className="fill-ink" />
        <path d={`M185 ${GROUND - 164} a11 9.5 0 0 1 22 0 z`} className="fill-amber" />
        <line x1={182} y1={GROUND - 164} x2={210} y2={GROUND - 164} className="stroke-amber" strokeWidth="2.6" strokeLinecap="round" />
      </g>

      {/* What the shift produced, as the record it becomes */}
      <g>
        <rect x={350} y={96} width={120} height={70} rx={5} className="fill-surface stroke-line-strong" strokeWidth="1.2" />
        <text x={362} y={115} className="fill-subtle" fontSize="8.5" fontWeight="600">SITE REPORT</text>
        <line x1={362} y1={122} x2={458} y2={122} className="stroke-line" strokeWidth="1" />
        <text x={362} y={138} className="fill-ink" fontSize="10.5" fontWeight="600">62 cum poured</text>
        <text x={362} y={152} className="fill-muted" fontSize="8.5">96 on site · M30 · clear</text>
        <circle cx={462} cy={104} r={3} className="fill-amber" />
      </g>
    </g>
  )
}

/* ==========================================================================
   Act two — the room
   The people are drawn before the table so it occludes them, which is what
   makes them read as sitting at it rather than standing behind it.
   ========================================================================== */

function RoomAct() {
  const seats = [318, 372, 426]

  return (
    <g data-act="room">
      <line x1={0} y1={GROUND} x2={480} y2={GROUND} className="stroke-line-strong" strokeWidth="1.5" />

      {/* The wall screen: the same day, read as data */}
      <g>
        <rect x={22} y={44} width={198} height={132} rx={6} className="fill-surface stroke-ink" strokeWidth="1.5" />
        <line x1={22} y1={68} x2={220} y2={68} className="stroke-line" strokeWidth="1" />
        <text x={34} y={61} className="fill-muted" fontSize="8.5" fontWeight="600">PORTFOLIO PROGRESS</text>

        {[
          { x: 40, h: 52, tone: 'fill-healthy' },
          { x: 70, h: 70, tone: 'fill-healthy' },
          { x: 100, h: 38, tone: 'fill-amber' },
          { x: 130, h: 24, tone: 'fill-critical' },
          { x: 160, h: 58, tone: 'fill-healthy' },
        ].map((bar) => (
          <rect
            key={bar.x}
            data-screen-bar
            x={bar.x}
            y={160 - bar.h}
            width={20}
            height={bar.h}
            rx={2}
            className={bar.tone}
          />
        ))}
        <line x1={34} y1={160} x2={208} y2={160} className="stroke-line-strong" strokeWidth="1.2" />

        {/* The finding that changes what the meeting is about */}
        <g data-screen-alert opacity="0">
          <rect x={112} y={72} width={96} height={28} rx={4} className="fill-surface" />
          <rect x={112} y={72} width={96} height={28} rx={4} className="fill-critical" opacity="0.14" />
          <rect x={112} y={72} width={3} height={28} className="fill-critical" />
          <text x={122} y={85} className="fill-critical" fontSize="9" fontWeight="700">−16.7 PTS</text>
          <text x={122} y={95} className="fill-critical" fontSize="8">Skyline Tower</text>
        </g>
      </g>

      {/* The presenter, pointing at the screen. Shoulder at (250, 196). */}
      <g>
        <line x1={248} y1={GROUND} x2={242} y2={GROUND - 30} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <line x1={258} y1={GROUND} x2={252} y2={GROUND - 30} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <rect x={241} y={GROUND - 64} width={19} height={36} rx={6} className="fill-ink" />
        <line x1={254} y1={GROUND - 56} x2={266} y2={GROUND - 38} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        <g data-point-arm>
          <line x1={250} y1={GROUND - 60} x2={226} y2={GROUND - 74} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
          <circle cx={224} cy={GROUND - 75} r={3} className="fill-amber" />
        </g>
        <circle data-head cx={250} cy={GROUND - 76} r={9} className="fill-ink" />
      </g>

      {/* The people, then the table over them */}
      {seats.map((x, index) => (
        <g key={x}>
          <path d={`M${x - 19} ${GROUND - 46} a19 18 0 0 1 38 0 z`} className="fill-ink" opacity={index === 1 ? 1 : 0.84} />
          {/* The site engineer came straight in from site */}
          {index === 2 && <rect x={x - 15} y={GROUND - 56} width={30} height={6} className="fill-amber" opacity="0.9" />}
          <circle data-head cx={x} cy={GROUND - 70} r={9.5} className="fill-ink" opacity={index === 1 ? 1 : 0.84} />
        </g>
      ))}

      <ellipse cx={372} cy={GROUND - 26} rx={96} ry={24} className="fill-surface stroke-ink" strokeWidth="1.5" />
      <ellipse cx={372} cy={GROUND - 26} rx={96} ry={24} className="fill-ink" opacity="0.04" />

      {/* A laptop open on the table, and two pads */}
      <g>
        <rect x={314} y={GROUND - 42} width={30} height={18} rx={2} className="fill-surface stroke-ink" strokeWidth="1.2" />
        <rect x={309} y={GROUND - 25} width={40} height={3.5} rx={1.75} className="fill-ink" />
        <rect x={370} y={GROUND - 34} width={24} height={15} rx={2} className="fill-line-strong" opacity="0.55" />
        <rect x={414} y={GROUND - 34} width={24} height={15} rx={2} className="fill-line-strong" opacity="0.55" />
      </g>

      {/* The decision the meeting produced */}
      <g>
        <rect x={350} y={80} width={120} height={82} rx={5} className="fill-surface stroke-line-strong" strokeWidth="1.2" />
        <text x={362} y={99} className="fill-subtle" fontSize="8.5" fontWeight="600">DECISION</text>
        <line x1={362} y1={106} x2={458} y2={106} className="stroke-line" strokeWidth="1" />
        <text x={362} y={122} className="fill-ink" fontSize="10.5" fontWeight="600">Second shift</text>
        <text x={362} y={136} className="fill-muted" fontSize="8.5">Structure phase, Monday</text>
        <text x={362} y={152} className="fill-healthy" fontSize="9" fontWeight="600">Recovers 41 days</text>
        <circle cx={462} cy={88} r={3} className="fill-healthy" />
      </g>
    </g>
  )
}

/* ==========================================================================
   Act three — the money
   The transfer runs left to right across the frame, so it reads as a direction
   rather than a meeting: capital leaves one hand and arrives as floors on the
   right. The record card sits top right, where both other acts put it.
   ========================================================================== */

const TOWER_X = 352
const TOWER_W = 96
const FLOOR_H = 16

function CapitalAct() {
  return (
    <g data-act="capital">
      {/* Ground */}
      <line x1={0} y1={GROUND} x2={480} y2={GROUND} className="stroke-line-strong" strokeWidth="1.5" />

      {/* The investor. Shoulder at (113, 200), briefcase in the far hand. */}
      <g>
        <line x1={104} y1={GROUND} x2={98} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <line x1={114} y1={GROUND} x2={108} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />

        {/* The far arm, carrying the case the money came out of */}
        <line x1={100} y1={GROUND - 54} x2={86} y2={GROUND - 34} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        <path d={`M78 ${GROUND - 34} a7 6 0 0 1 14 0`} className="stroke-ink" strokeWidth="1.6" fill="none" />
        <rect x={74} y={GROUND - 34} width={22} height={16} rx={2} className="fill-ink" />
        <line x1={74} y1={GROUND - 27} x2={96} y2={GROUND - 27} className="stroke-amber" strokeWidth="1.6" />

        <rect x={99} y={GROUND - 60} width={19} height={34} rx={6} className="fill-ink" />
        {/* A collar and tie rather than a hi-vis band: the same body, read as
            the other side of the table */}
        <path d={`M108.5 ${GROUND - 60} l-5 8 l5 4 l5 -4 z`} className="fill-surface" />
        <rect x={107} y={GROUND - 52} width={3} height={9} rx={1.5} className="fill-amber" />

        <g data-offer-arm>
          <line x1={116} y1={GROUND - 56} x2={136} y2={GROUND - 48} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        </g>
        <circle cx={108.5} cy={GROUND - 71} r={9} className="fill-ink" />
      </g>

      {/* The money crossing. Each bundle starts at the investor's hand. */}
      <g>
        {[0, 1, 2].map((index) => (
          <g key={index} data-note opacity="0">
            <rect x={138} y={GROUND - 54} width={20} height={12} rx={2} className="fill-amber" />
            <rect x={142} y={GROUND - 51} width={12} height={6} rx={1} className="fill-amber-deep" opacity="0.55" />
          </g>
        ))}
        {/* The path the money takes, left as a dotted trace */}
        <path
          d={`M140 ${GROUND - 48} q32 -34 64 0`}
          className="stroke-line-strong"
          strokeWidth="1"
          strokeDasharray="3 5"
          fill="none"
          opacity="0.6"
        />
      </g>

      {/* The contractor taking it, drawing under the far arm. Shoulder (231, 200). */}
      <g>
        <line x1={236} y1={GROUND} x2={230} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />
        <line x1={246} y1={GROUND} x2={240} y2={GROUND - 28} className="stroke-ink" strokeWidth="4.5" strokeLinecap="round" />

        <line x1={246} y1={GROUND - 54} x2={258} y2={GROUND - 34} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        {/* The rolled drawing the money is going to be spent on */}
        <rect
          x={255}
          y={GROUND - 48}
          width={7}
          height={28}
          rx={3.5}
          className="fill-line-strong"
          transform={`rotate(20 258.5 ${GROUND - 34})`}
        />

        <rect x={228} y={GROUND - 60} width={19} height={34} rx={6} className="fill-ink" />
        <rect x={228} y={GROUND - 50} width={19} height={6} className="fill-amber" />

        <g data-receive-arm>
          <line x1={231} y1={GROUND - 56} x2={208} y2={GROUND - 48} className="stroke-ink" strokeWidth="3.8" strokeLinecap="round" />
        </g>
        <circle cx={237.5} cy={GROUND - 71} r={9} className="fill-ink" />
        <path d={`M225.5 ${GROUND - 74} a12 10.5 0 0 1 24 0 z`} className="fill-amber" />
        <line x1={222.5} y1={GROUND - 74} x2={252.5} y2={GROUND - 74} className="stroke-amber" strokeWidth="2.8" strokeLinecap="round" />
      </g>

      {/* What the tranche buys: the envelope is drawn, the funded floors fill */}
      <g>
        <rect
          x={TOWER_X}
          y={GROUND - FLOOR_H * 4}
          width={TOWER_W}
          height={FLOOR_H * 4}
          className="stroke-line-strong"
          strokeWidth="1.2"
          strokeDasharray="4 4"
          fill="none"
        />
        {/* Already paid for */}
        {[0, 1].map((floor) => (
          <rect
            key={floor}
            x={TOWER_X}
            y={GROUND - FLOOR_H * (floor + 1)}
            width={TOWER_W}
            height={FLOOR_H}
            className="fill-surface stroke-ink"
            strokeWidth="1.3"
          />
        ))}
        {/* Paid for by the bundles crossing the frame */}
        {[2, 3].map((floor) => (
          <g key={floor} data-funded-floor opacity="0">
            <rect
              x={TOWER_X}
              y={GROUND - FLOOR_H * (floor + 1)}
              width={TOWER_W}
              height={FLOOR_H}
              className="fill-surface stroke-ink"
              strokeWidth="1.3"
            />
            <rect
              x={TOWER_X}
              y={GROUND - FLOOR_H * (floor + 1)}
              width={TOWER_W}
              height={FLOOR_H}
              className="fill-amber"
              opacity="0.22"
            />
          </g>
        ))}
      </g>

      {/* The tranche, marked once the last floor is covered */}
      <g data-fund-stamp opacity="0">
        <rect x={TOWER_X} y={GROUND - FLOOR_H * 4 - 20} width={TOWER_W} height={14} rx={3} className="fill-healthy" opacity="0.16" />
        <text x={TOWER_X + 9} y={GROUND - FLOOR_H * 4 - 10} className="fill-healthy" fontSize="8" fontWeight="700">
          TRANCHE FUNDED
        </text>
      </g>

      {/* The record the transfer produced */}
      <g>
        <rect x={350} y={96} width={120} height={70} rx={5} className="fill-surface stroke-line-strong" strokeWidth="1.2" />
        <text x={362} y={115} className="fill-subtle" fontSize="8.5" fontWeight="600">FUNDING RELEASE</text>
        <line x1={362} y1={122} x2={458} y2={122} className="stroke-line" strokeWidth="1" />
        <text x={362} y={138} className="fill-ink" fontSize="10.5" fontWeight="600">₹4.2 Cr released</text>
        <text x={362} y={152} className="fill-muted" fontSize="8.5">Tranche 3 · structure phase</text>
        <circle cx={462} cy={104} r={3} className="fill-amber" />
      </g>
    </g>
  )
}
