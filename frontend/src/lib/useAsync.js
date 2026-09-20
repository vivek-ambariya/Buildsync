import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Load data with loading / error / reload state.
 *
 * Every screen needs the same three states, so they are produced once here
 * rather than re-implemented per page.
 */
export function useAsync(loader, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const mounted = useRef(true)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await loaderRef.current()
      if (mounted.current) setData(result)
      return result
    } catch (err) {
      if (mounted.current) setError(err)
      return null
    } finally {
      if (mounted.current) setLoading(false)
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
