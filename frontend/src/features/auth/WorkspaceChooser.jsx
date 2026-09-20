import { useLayoutEffect, useRef } from 'react'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/cn'
import { WORKSPACE_LIST } from '@/lib/workspaces'
import { gsap, prefersReducedMotion } from '@/animations'

/**
 * Step one of signing in: which BuildSync are you here for?
 *
 * The four cards are a statement about the product — this is not one
 * dashboard with permissions bolted on, it is four working surfaces. Picking
 * one asks for that workspace; the server decides whether the account may
 * open it, so nothing here is a security boundary.
 */
export function WorkspaceChooser({ onSelect }) {
  const scope = useRef(null)

  useLayoutEffect(() => {
    const cards = scope.current?.querySelectorAll('[data-card]')
    if (!cards?.length) return undefined
    if (prefersReducedMotion()) {
      gsap.set(cards, { opacity: 1, y: 0 })
      return undefined
    }
    const tween = gsap.fromTo(
      cards,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.38, ease: 'power3.out', stagger: 0.06 },
    )
    return () => tween.kill()
  }, [])

  return (
    <div ref={scope} className="w-full">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {WORKSPACE_LIST.map((workspace) => (
          <button
            key={workspace.slug}
            type="button"
            data-card
            onClick={() => onSelect(workspace)}
            className={cn(
              'group relative flex flex-col rounded-panel border border-line bg-surface p-5 text-left',
              'transition-[border-color,box-shadow,transform] duration-200 ease-out',
              'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50',
            )}
          >
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-panel border border-line bg-raised text-muted',
                'transition-[color,transform,border-color] duration-200 ease-out',
                'group-hover:-translate-y-0.5 group-hover:border-amber/40 group-hover:text-amber-deep',
              )}
            >
              <workspace.icon size={18} strokeWidth={1.9} />
            </span>

            <h2 className="mt-4 font-display text-h4 text-ink">{workspace.label}</h2>
            <p className="mt-1.5 flex-1 text-base leading-relaxed text-muted">
              {workspace.description}
            </p>

            <span className="mt-5 inline-flex items-center gap-1.5 text-tiny font-medium text-ink">
              Continue as {workspace.label}
              <ArrowRight
                size={13}
                className="transition-transform duration-200 ease-out group-hover:translate-x-0.5"
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
