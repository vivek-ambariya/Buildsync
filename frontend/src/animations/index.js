/**
 * The motion system.
 *
 * One vocabulary of durations and easings, used everywhere. Motion here does
 * one of two jobs: it orchestrates a single entrance when a view opens, or it
 * answers something the person just did. Nothing animates for decoration.
 */
import gsap from 'gsap'

export const DURATION = {
  /** Micro feedback: hover, press, toggle. */
  fast: 0.16,
  /** Standard UI transition: panels, tabs, popovers. */
  base: 0.28,
  /** A view arriving, or a modal opening. */
  entrance: 0.42,
  /** A large reveal on a landing section. */
  reveal: 0.6,
}

export const EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  soft: 'power1.out',
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Reveal elements marked [data-enter] inside a scope, in document order. */
export function enter(scope, { stagger = 0.045, y = 10, delay = 0 } = {}) {
  const targets = scope?.querySelectorAll?.('[data-enter]')
  if (!targets?.length) return null
  if (prefersReducedMotion()) {
    gsap.set(targets, { opacity: 1, y: 0 })
    return null
  }
  return gsap.fromTo(
    targets,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration: DURATION.entrance, ease: EASE.out, stagger, delay, clearProps: 'transform' },
  )
}

/** Count a number up to its value. Used once, when a metric first lands. */
export function countTo(node, value, { duration = 0.9, format = (v) => Math.round(v) } = {}) {
  if (!node) return null
  if (prefersReducedMotion()) {
    node.textContent = format(value)
    return null
  }
  const state = { value: 0 }
  return gsap.to(state, {
    value,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      node.textContent = format(state.value)
    },
  })
}

/** A bar or ring growing to its real proportion. */
export function growBar(node, percent, { delay = 0, duration = DURATION.reveal } = {}) {
  if (!node) return null
  const width = `${Math.max(0, Math.min(100, percent))}%`
  if (prefersReducedMotion()) {
    gsap.set(node, { width })
    return null
  }
  return gsap.fromTo(node, { width: '0%' }, { width, duration, ease: EASE.out, delay })
}

export function modalIn(panel, overlay) {
  if (prefersReducedMotion()) return null
  const timeline = gsap.timeline()
  if (overlay) timeline.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: DURATION.base }, 0)
  if (panel) {
    timeline.fromTo(
      panel,
      { opacity: 0, y: 12, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: DURATION.entrance, ease: EASE.out },
      0,
    )
  }
  return timeline
}

export function drawerIn(panel, overlay, { from = 'right' } = {}) {
  if (prefersReducedMotion()) return null
  const timeline = gsap.timeline()
  if (overlay) timeline.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: DURATION.base }, 0)
  if (panel) {
    timeline.fromTo(
      panel,
      { x: from === 'right' ? 32 : -32, opacity: 0 },
      { x: 0, opacity: 1, duration: DURATION.entrance, ease: EASE.out },
      0,
    )
  }
  return timeline
}

/** Scroll-triggered reveal for the landing page, via IntersectionObserver. */
export function observeReveal(root = document, { threshold = 0.18 } = {}) {
  const nodes = root.querySelectorAll('[data-reveal]:not([data-revealed])')
  if (!nodes.length) return () => {}
  if (prefersReducedMotion()) {
    nodes.forEach((node) => {
      node.dataset.revealed = 'true'
      gsap.set(node, { opacity: 1, y: 0 })
    })
    return () => {}
  }

  gsap.set(nodes, { opacity: 0, y: 18 })
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const node = entry.target
        node.dataset.revealed = 'true'
        const children = node.querySelectorAll('[data-reveal-child]')
        gsap.to(node, { opacity: 1, y: 0, duration: DURATION.reveal, ease: EASE.out })
        if (children.length) {
          gsap.fromTo(
            children,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: DURATION.entrance, ease: EASE.out, stagger: 0.07, delay: 0.08 },
          )
        }
        observer.unobserve(node)
      })
    },
    { threshold, rootMargin: '0px 0px -8% 0px' },
  )
  nodes.forEach((node) => observer.observe(node))
  return () => observer.disconnect()
}

export { gsap }
