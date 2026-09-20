import { CheckCircle2, Sun } from 'lucide-react'

import { useEnter } from '@/animations/useMotion'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { QuickActions } from '@/features/site-ops/QuickActions'
import { SitePageHeader } from '@/features/site-ops/SitePageHeader'
import { TaskCard } from '@/features/site-ops/TaskCard'

/**
 * Today, and nothing else.
 *
 * The same task cards as "My tasks" against a narrower question: what is due
 * or in flight right now. It exists separately because a site manager
 * standing in front of the work does not want to filter a list to find out
 * what they are supposed to be doing.
 */
export default function TodaysWork() {
  const { overview, loading, error, reload, project } = useSite()
  const scope = useEnter([loading, Boolean(overview)])

  if (error) {
    return <ErrorState title="We could not load today's work" description={error.message} onRetry={() => reload()} />
  }

  const tasks = overview?.tasks_today || []
  const done = tasks.filter((task) => task.status === 'completed')
  const open = tasks.filter((task) => task.status !== 'completed')

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Today's work"
        count={open.length}
        countLabel={`still open on ${project?.name || 'this site'}`}
      />

      <section className="mb-6" data-enter>
        <QuickActions onChanged={() => reload()} columns={2} className="sm:!grid-cols-3" />
      </section>

      {loading && !overview ? (
        <div className="space-y-3" data-enter>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-1/3" />
              <Skeleton className="mt-5 h-11 w-full" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={Sun}
            title="Nothing scheduled for today"
            description="No tasks are due and nothing is mid-flight. Anything you do get to can still be recorded as progress."
          />
        </div>
      ) : (
        <div className="space-y-5" data-enter>
          {open.length > 0 && (
            <section>
              <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-muted">
                Still open
              </h2>
              <div className="space-y-3">
                {open.map((task) => (
                  <TaskCard key={task.id} task={task} onChanged={() => reload()} compact />
                ))}
              </div>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="mb-2.5 flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-[0.05em] text-healthy">
                <CheckCircle2 size={13} />
                Completed today
              </h2>
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                {done.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle2 size={16} className="shrink-0 text-healthy" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base text-ink">{task.title}</span>
                      <span className="block truncate text-tiny text-subtle">{task.phase}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
