import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Load data with loading / error / reload state.
 *
 * Every screen needs the same three states, so they are produced once here
 * rather than re-implemented per page.
 *
 * Responses are sequenced. Changing a filter starts a new request without
 * cancelling the one already in flight, and the two can come back in either
 * order — a narrow search hitting an unindexed regex is slower than the
 * indexed read that replaces it, so the *older* request routinely lands last.
 * Without a guard, last-to-answer wins: you clear a filter and the table
 * keeps showing the filtered rows, because the superseded response arrived
 * after the fresh one and overwrote it.
 *
 * Each run therefore takes a ticket, and only the newest ticket is allowed to
 * write state. A stale response is dropped rather than rendered — including
 * its `loading: false`, which would otherwise hide the spinner while the real
 * request was still running.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const mounted = useRef(true)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  // Monotonic ticket. Incremented when a request starts; a response may only
  // write state if no newer request has started since.
  const generation = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    const ticket = (generation.current += 1)
    const current = () => mounted.current && ticket === generation.current

    setLoading(true)
    setError(null)
    try {
      const result = await loaderRef.current()
      if (current()) setData(result)
      return result
    } catch (err) {
      if (current()) setError(err)
      return null
    } finally {
      if (current()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (immediate) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, error, loading, reload: run, setData }
}

/** Debounce a fast-changing value, for search inputs. */
export function useDebounced(value, delay = 220) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
