import { useMemo, useState } from 'react'
import { ListChecks } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useEnter } from '@/animations/useMotion'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { FilterStrip, SitePageHeader } from '@/features/site-ops/SitePageHeader'
import { TaskCard } from '@/features/site-ops/TaskCard'

/**
 * The tasks this person and their crew are carrying.
 *
 * Never the project's whole task list — the API narrows it to the site team
 * before it is sent. Ordered by deadline with overdue work first, because on
 * site "what is late" is the only sort anybody wants.
 */
export default function SiteTasks() {
  const { projectId, project } = useSite()
  const [filter, setFilter] = useState('open')
  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.tasks({ project_id: projectId }) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  const { visible, counts } = useMemo(() => {
    const rows = data || []
    const byFilter = {
      open: rows.filter((task) => task.status !== 'completed'),
      overdue: rows.filter((task) => task.overdue),
      blocked: rows.filter((task) => task.blocked),
      completed: rows.filter((task) => task.status === 'completed'),
      all: rows,
    }
    // Late first, then by deadline. Nothing else is a useful order here.
    const sorted = [...(byFilter[filter] || rows)].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return new Date(a.deadline) - new Date(b.deadline)
    })
    return {
      visible: sorted,
      counts: Object.fromEntries(Object.entries(byFilter).map(([key, value]) => [key, value.length])),
    }
  }, [data, filter])

  if (error) {
    return <ErrorState title="We could not load your tasks" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <SitePageHeader
        title="My tasks"
        count={counts.open || 0}
        countLabel={`open on ${project?.name || 'this site'}`}
      >
        <FilterStrip
          className="mt-3.5"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'overdue', label: 'Overdue', count: counts.overdue },
            { value: 'blocked', label: 'Blocked', count: counts.blocked },
            { value: 'completed', label: 'Done', count: counts.completed },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </SitePageHeader>

      {loading && !data ? (
        <div className="space-y-3" data-enter>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/3" />
              <Skeleton className="mt-5 h-11 w-full" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={ListChecks}
            title={filter === 'open' ? 'No open tasks' : 'Nothing here'}
            description={
              filter === 'open'
                ? 'Everything assigned to you and your crew on this site is closed.'
                : 'No tasks match this filter right now.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3" data-enter>
          {visible.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={reload} compact />
          ))}
        </div>
      )}
    </div>
  )
}
