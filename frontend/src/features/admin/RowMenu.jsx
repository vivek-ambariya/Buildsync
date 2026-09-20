import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'

/**
 * The per-row actions menu.
 *
 * Rendered in a portal and positioned against the trigger, because a table
 * cell clips its own overflow and a menu opening on the last row would be cut
 * off by the panel edge. It flips above the trigger when there is no room
 * below, and closes on scroll rather than drifting away from its row.
 */
export function RowMenu({ items = [], label = 'Actions' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)

  const place = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const estimated = items.length * 36 + 12
    const below = window.innerHeight - rect.bottom
    const flip = below < estimated && rect.top > estimated
    setPosition({
      top: flip ? rect.top - estimated - 6 : rect.bottom + 6,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useLayoutEffect(() => {
    if (!open || !menuRef.current || prefersReducedMotion()) return
    gsap.fromTo(
      menuRef.current,
      { opacity: 0, y: -4, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.16, ease: 'power2.out' },
    )
  }, [open, position])

  useEffect(() => {
    if (!open) return undefined
    const close = () => setOpen(false)
    const onClickAway = (event) => {
      if (
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', onClickAway), 0)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onClickAway)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-control text-subtle',
          'transition-colors duration-150 hover:bg-raised hover:text-ink',
          open && 'bg-raised text-ink',
        )}
      >
        <MoreHorizontal size={16} />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[85] w-48 overflow-hidden rounded-panel border border-line bg-surface py-1 shadow-popover"
            style={{ top: position.top, right: position.right }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  item.onSelect?.()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-base',
                  'transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40',
                  item.destructive
                    ? 'text-critical hover:bg-critical-wash'
                    : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {item.icon && <item.icon size={14} className="shrink-0" />}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
