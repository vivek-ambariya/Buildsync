import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'

/**
 * The confirmation a site manager gets back for a submission.
 *
 * Progress, a report or an issue sent from site is the one moment where the
 * person needs to be certain something left the phone — they are about to
 * walk away from it. So the confirmation is a full-screen beat rather than a
 * toast in a corner they may not look at: the ring draws, the tick strokes
 * itself, and it dismisses on its own so nobody has to tap "OK".
 */
export function SuccessBurst({ open, title = 'Saved', detail, onDone, duration = 1700 }) {
  const ring = useRef(null)
  const tick = useRef(null)
  const card = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    if (!prefersReducedMotion()) {
      const timeline = gsap.timeline()
      timeline
        .fromTo(card.current, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'power3.out' })
        .fromTo(
          ring.current,
          { strokeDashoffset: 176, rotate: -90, transformOrigin: '50% 50%' },
          { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' },
          0.05,
        )
        .fromTo(tick.current, { strokeDashoffset: 34 }, { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' }, 0.42)
    }

    const timer = setTimeout(() => onDone?.(), duration)
    return () => clearTimeout(timer)
  }, [open, onDone, duration])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-paper/92 backdrop-blur-sm"
      role="status"
      aria-live="assertive"
      onClick={onDone}
    >
      <div ref={card} className={cn('flex flex-col items-center px-8 text-center')}>
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden>
          <circle cx="44" cy="44" r="40" className="stroke-line" strokeWidth="3" />
          <circle
            ref={ring}
            cx="44"
            cy="44"
            r="28"
            className="stroke-healthy"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="176"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
          <path
            ref={tick}
            d="M32 44.5 L40.5 53 L57 36"
            className="stroke-healthy"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="34"
          />
        </svg>
        <p className="mt-5 font-display text-h3 text-ink">{title}</p>
        {detail && <p className="mt-1.5 max-w-xs text-body leading-relaxed text-muted">{detail}</p>}
      </div>
    </div>,
    document.body,
  )
}
