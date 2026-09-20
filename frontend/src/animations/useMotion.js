import { useEffect, useLayoutEffect, useRef } from 'react'

import { countTo, enter, gsap, growBar, observeReveal } from './index'

/** Run a GSAP setup inside a scoped context that cleans itself up. */
export function useGsap(setup, deps = []) {
  const scope = useRef(null)
  useLayoutEffect(() => {
    if (!scope.current) return undefined
    const context = gsap.context(() => setup(scope.current), scope)
    return () => context.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return scope
}

/** The standard view entrance: reveal every [data-enter] in order. */
export function useEnter(deps = [], options) {
  return useGsap((scope) => enter(scope, options), deps)
}

/** Count a metric up once its value is known. */
export function useCountUp(value, format) {
  const ref = useRef(null)
  const played = useRef(false)
  useEffect(() => {
    if (ref.current === null || value === null || value === undefined) return
    if (played.current) {
      ref.current.textContent = format ? format(value) : Math.round(value)
      return
    }
    played.current = true
    countTo(ref.current, value, format ? { format } : undefined)
  }, [value, format])
  return ref
}

/** Grow a progress bar to its value when it enters the page. */
export function useGrowBar(percent, delay = 0) {
  const ref = useRef(null)
  useEffect(() => {
    growBar(ref.current, percent, { delay })
  }, [percent, delay])
  return ref
}

/** Attach scroll reveals for a landing section tree. */
export function useScrollReveal(deps = []) {
  const scope = useRef(null)
  useEffect(() => {
    if (!scope.current) return undefined
    return observeReveal(scope.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return scope
}
