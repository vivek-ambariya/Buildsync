import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { api } from '@/lib/api'

const SiteContext = createContext(null)
const PROJECT_KEY = 'buildsync-site-project'

/**
 * The site manager's working context.
 *
 * A site manager is standing on one site, so the whole app is scoped to one
 * project at a time rather than filtered per screen. That choice is held here
 * and remembered between sessions, because the answer is almost always the
 * same site tomorrow as it was today.
 *
 * The overview payload is loaded once and shared: the dashboard, the header
 * and the assistant all read the same snapshot rather than each fetching it,
 * which on a site connection is the difference between one request and four.
 */
export function SiteProvider({ children }) {
  const [projectId, setProjectId] = useState(() => {
    try {
      return localStorage.getItem(PROJECT_KEY) || null
    } catch {
      return null
    }
  })
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(
    async (id = projectId) => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.site.overview(id || undefined)
        setOverview(data)
        // The API decides which site is current when none was chosen — the
        // first one still being built — so adopt its answer.
        if (!id && data?.project?.id) setProjectId(data.project.id)
        return data
      } catch (err) {
        setError(err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    load(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const selectProject = useCallback((id) => {
    try {
      if (id) localStorage.setItem(PROJECT_KEY, id)
    } catch {
      /* private browsing: the choice lasts for this session only */
    }
    setProjectId(id)
  }, [])

  const value = useMemo(
    () => ({
      projectId: overview?.project?.id || projectId,
      project: overview?.project || null,
      projects: overview?.projects || [],
      overview,
      loading,
      error,
      reload: load,
      selectProject,
    }),
    [projectId, overview, loading, error, load, selectProject],
  )

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite() {
  const context = useContext(SiteContext)
  if (!context) throw new Error('useSite must be used inside SiteProvider')
  return context
}
