import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion, DURATION, EASE } from '@/animations'

/**
 * A bottom sheet.
 *
 * The site app's answer to a modal. On a phone it rises from the bottom edge,
 * where the thumb already is, and its actions sit in a bar pinned above the
 * home indicator — so a form can be completed without the hand ever moving to
 * the top of the screen. From `sm` upward it becomes an ordinary centred
 * dialog, because a desktop pointer has no such constraint.
 *
 * The grab handle is decoration with a job: it says "this came from the
 * bottom and goes back there", which is the only affordance a person gets for
 * the swipe-to-dismiss they will instinctively try.
 */
export function Sheet({ open, onClose, title, description, footer, children, className }) {
  const panel = useRef(null)
  const overlay = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    const timeline = gsap.timeline()
    if (overlay.current) {
      timeline.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: DURATION.base }, 0)
    }
    if (panel.current) {
      // Below `sm` the sheet travels up from the edge; above it, it settles
      // in place like any dialog. One timeline, two physics.
      const fromBottom = window.matchMedia('(max-width: 639px)').matches
      timeline.fromTo(
        panel.current,
        fromBottom ? { yPercent: 100 } : { opacity: 0, y: 14, scale: 0.985 },
        fromBottom
          ? { yPercent: 0, duration: DURATION.entrance, ease: EASE.out }
          : { opacity: 1, y: 0, scale: 1, duration: DURATION.entrance, ease: EASE.out },
        0,
      )
    }
  }, [open])

  // Move focus in, but never into a text field: a keyboard springing up the
  // moment a sheet opens covers the very thing the person came to read.
  useEffect(() => {
    if (!open) return
    panel.current?.focus?.()
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div ref={overlay} className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface outline-none',
          'rounded-t-[18px] border-t border-line',
          'sm:max-h-[86vh] sm:max-w-lg sm:rounded-panel sm:border sm:shadow-overlay',
          className,
        )}
      >
        <div className="shrink-0 border-b border-line">
          <div className="flex justify-center pt-2.5 sm:hidden">
            <span className="h-1 w-9 rounded-pill bg-line-strong" aria-hidden />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="font-display text-h4 text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-tiny leading-snug text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-subtle transition-colors active:bg-raised"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line bg-raised px-4 py-3 pb-safe sm:px-5 sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
