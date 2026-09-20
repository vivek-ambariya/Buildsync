/**
 * Scroll-scene helpers.
 *
 * Every landing scene is driven off scroll position rather than a trigger-once
 * animation, so the visitor is scrubbing the page rather than watching it play.
 * These wrap the three patterns used repeatedly: parallax drift, a scrubbed
 * timeline, and a pinned track that moves horizontally.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { prefersReducedMotion } from '@/animations'

gsap.registerPlugin(ScrollTrigger)

/**
 * Whether a target is worth animating.
 *
 * An empty NodeList is truthy, so passing one straight to GSAP logs a
 * "target not found" warning for every scene that happens not to contain that
 * part. Scenes legitimately differ in which parts they have.
 */
export function has(target) {
  if (!target) return false
  if (typeof target === 'string') return document.querySelector(target) !== null
  if (typeof target.length === 'number') return target.length > 0
  return true
}

/**
 * Drift an element as its section passes through the viewport.
 *
 * `distance` is in pixels and signed: negative moves up (faster than the page),
 * positive moves down (slower, so it lags behind). Layering two or three of
 * these at different distances is what reads as depth.
 */
export function parallax(target, { distance = -80, trigger, start = 'top bottom', end = 'bottom top', scrub = 0.8 } = {}) {
  if (prefersReducedMotion() || !has(target)) return null
  return gsap.fromTo(
    target,
    { y: -distance / 2 },
    {
      y: distance / 2,
      ease: 'none',
      scrollTrigger: { trigger: trigger || target, start, end, scrub },
    },
  )
}

/** Slide an element sideways as its section scrolls, for drifting rows. */
export function drift(target, { distance = 160, trigger, scrub = 1 } = {}) {
  if (prefersReducedMotion() || !has(target)) return null
  return gsap.fromTo(
    target,
    { x: -distance / 2 },
    {
      x: distance / 2,
      ease: 'none',
      scrollTrigger: { trigger: trigger || target, start: 'top bottom', end: 'bottom top', scrub },
    },
  )
}

/** A timeline tied to how far through a section the visitor has scrolled. */
export function scrubbed(trigger, { start = 'top 80%', end = 'bottom 55%', scrub = 0.7 } = {}) {
  if (prefersReducedMotion()) return gsap.timeline({ paused: false })
  return gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger, start, end, scrub },
  })
}

/**
 * Pin a section and move its inner track horizontally as the visitor scrolls
 * down. Returns the timeline so a scene can hang its own tweens off it.
 */
export function horizontalTrack(section, track, { extra = 0 } = {}) {
  if (prefersReducedMotion() || !section || !track) return null

  const distance = () => Math.max(0, track.scrollWidth - section.offsetWidth)

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${distance() + window.innerHeight * (0.5 + extra)}`,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })

  timeline.to(track, { x: () => -distance(), duration: 1 }, 0)
  return timeline
}

/** Count a figure up while its section is being scrolled into place. */
export function scrubCount(node, value, { trigger, format = (v) => Math.round(v).toLocaleString('en-IN') } = {}) {
  if (!node) return null
  if (prefersReducedMotion()) {
    node.textContent = format(value)
    return null
  }
  const state = { value: 0 }
  return gsap.to(state, {
    value,
    ease: 'none',
    scrollTrigger: { trigger: trigger || node, start: 'top 88%', end: 'top 45%', scrub: 0.5 },
    onUpdate: () => {
      node.textContent = format(state.value)
    },
  })
}

/**
 * Reveal a heading by wiping its clip path open as it scrolls in.
 *
 * Used instead of a fade-and-slide-up so the page's section entrances do not
 * all read as the same generic effect.
 */
export function wipeIn(targets, { trigger, stagger = 0.08 } = {}) {
  if (prefersReducedMotion() || !has(targets)) return null
  return gsap.fromTo(
    targets,
    { clipPath: 'inset(0 100% 0 0)', y: 8 },
    {
      clipPath: 'inset(0 0% 0 0)',
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      stagger,
      scrollTrigger: { trigger: trigger || targets, start: 'top 82%', once: true },
    },
  )
}

export { gsap, ScrollTrigger }
