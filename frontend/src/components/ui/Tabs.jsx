import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'

/**
 * A sliding indicator ties the active tab to its content: the underline
 * travels to the new tab rather than jumping, so the move is legible.
 */
export function Tabs({ tabs, value, onChange, className }) {
  const listRef = useRef(null)
  const indicatorRef = useRef(null)
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    const active = list.querySelector(`[data-tab="${value}"]`)
    if (!active) return

    const target = { width: active.offsetWidth, x: active.offsetLeft }
    if (!ready || prefersReducedMotion()) {
      gsap.set(indicator, { ...target, opacity: 1 })
      setReady(true)
    } else {
      gsap.to(indicator, { ...target, duration: 0.3, ease: 'power3.out' })
    }

    // Keep the active tab visible when the strip scrolls on narrow screens.
    active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [value, tabs, ready])

  useEffect(() => {
    const onResize = () => setReady(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div className={cn('relative border-b border-line', className)}>
      <div ref={listRef} className="no-scrollbar relative flex gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            data-tab={tab.value}
            role="tab"
            aria-selected={value === tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-base font-medium transition-colors duration-150',
              value === tab.value ? 'text-ink' : 'text-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count !== null && (
              <span
                className={cn(
                  'ml-1.5 rounded-pill px-1.5 py-0.5 text-micro tabular',
                  value === tab.value ? 'bg-ink text-paper' : 'bg-raised text-subtle',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <span
          ref={indicatorRef}
          className="pointer-events-none absolute bottom-0 left-0 h-[2px] bg-ink opacity-0"
          aria-hidden
        />
      </div>
    </div>
  )
}
