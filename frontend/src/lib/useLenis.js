import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import { prefersReducedMotion } from '@/animations'

gsap.registerPlugin(ScrollTrigger)

/**
 * Smooth scrolling, driven off the GSAP ticker so ScrollTrigger and Lenis
 * share one clock. Without that they fight each other and scrubbed
 * animations stutter.
 *
 * Disabled entirely when the visitor asks for reduced motion — smoothing is
 * exactly the kind of motion that setting is about.
 */
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return undefined

    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9, touchMultiplier: 1.6 })
    const update = (time) => lenis.raf(time * 1000)

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(update)
      lenis.destroy()
      gsap.ticker.lagSmoothing(500, 33)
    }
  }, [enabled])
}
