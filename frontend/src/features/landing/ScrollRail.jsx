import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/animations'
import { gsap, ScrollTrigger } from './scroll'

/**
 * A levelling staff down the left edge of the page.
 *
 * Construction measures vertical distance with a graduated staff, so the
 * page's depth is graduated the same way: fixed ticks, a travelling amber band
 * and a marker per chapter. It carries no text — the chapters are already
 * named in the nav, and a label here would sit over content that travels
 * behind it. What is left is a pure depth gauge, which is all a staff is.
 */
export function ScrollRail({ chapters = [] }) {
  const root = useRef(null)
  const band = useRef(null)
  const [active, setActive] = useState(0)

  useLayoutEffect(() => {
    if (prefersReducedMotion() || !band.current) return undefined
    const context = gsap.context(() => {
      gsap.fromTo(
        band.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          transformOrigin: 'top center',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.4 },
        },
      )
    }, root)
    return () => context.revert()
  }, [])

  // Which chapter is in view, read from the sections themselves so the gauge
  // cannot fall out of step with the page.
  useEffect(() => {
    if (!chapters.length) return undefined
    const triggers = chapters
      .map((chapter, index) => {
        const element = document.querySelector(chapter.selector)
        if (!element) return null
        return ScrollTrigger.create({
          trigger: element,
          start: 'top 55%',
          end: 'bottom 45%',
          onToggle: (self) => self.isActive && setActive(index),
        })
      })
      .filter(Boolean)
    return () => triggers.forEach((trigger) => trigger.kill())
  }, [chapters])

  if (!chapters.length) return null

  return (
    <div
      ref={root}
      className="pointer-events-none fixed left-0 top-0 z-30 hidden h-screen w-8 xl:block"
      aria-hidden
    >
      {/* Panels in the pipeline travel the full page width and pass behind
          this, so the gauge carries a narrow fade of its own. */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper via-paper/85 to-transparent" />

      <div className="relative ml-4 h-full">
        {/* Graduations */}
        <div className="absolute inset-y-0 left-0 w-px bg-line" />
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-16">
          {Array.from({ length: 25 }).map((_, index) => (
            <span
              key={index}
              className={cn('block bg-line-strong', index % 4 === 0 ? 'h-px w-2.5' : 'h-px w-1.5')}
            />
          ))}
        </div>

        {/* Travelling band: how far down the document you are */}
        <div
          ref={band}
          className="absolute inset-y-0 left-0 w-[2px] origin-top bg-amber"
          style={{ transform: 'scaleY(0)' }}
        />

        {/* Chapter markers: which section you are standing in */}
        <ol className="absolute inset-y-0 left-0 flex flex-col justify-center gap-4 pl-1">
          {chapters.map((chapter, index) => (
            <li key={chapter.selector}>
              <span
                className={cn(
                  'block rounded-pill transition-all duration-300 ease-out',
                  index === active ? 'h-[3px] w-3.5 bg-amber' : 'h-px w-1.5 bg-line-strong',
                )}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
