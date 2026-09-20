import { useState } from 'react'
import { Gauge, Plus, Users } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { formatNumber, relativeTime } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { ProgressUpdateSheet } from '@/features/site-ops/ProgressUpdateSheet'
import { SitePageHeader } from '@/features/site-ops/SitePageHeader'

/**
 * Everything recorded from this site, newest first.
 *
 * Each entry shows the move rather than the position — 64% → 72% — because
 * what a site manager checks here is whether today's work was captured, not
 * where the project stands overall.
 */
export default function ProgressUpdates() {
  const { projectId, project, reload: reloadSite } = useSite()
  const [updating, setUpdating] = useState(false)
  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.progress(projectId) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  if (error) {
    return <ErrorState title="We could not load progress updates" description={error.message} onRetry={reload} />
  }

  const updates = data || []

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Progress updates"
        count={updates.length}
        countLabel={`recorded on ${project?.name || 'this site'}`}
        action={
          <Button variant="accent" onClick={() => setUpdating(true)}>
            <Plus size={15} />
            Update
          </Button>
        }
      />

      {loading && !data ? (
        <div className="space-y-3" data-enter>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-4 h-2 w-full" />
            </div>
          ))}
        </div>
      ) : updates.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={Gauge}
            title="No progress recorded yet"
            description="Record what got built and the task, the site record and the reorder dates all move with it."
            action={
              <Button variant="accent" onClick={() => setUpdating(true)}>
                <Plus size={15} />
                Record the first update
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" data-enter>
          {updates.map((update) => {
            const moved = Math.round((update.new_progress - update.previous_progress) * 10) / 10
            return (
              <li key={update.id} className="rounded-panel border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-ink">
                      {update.task_title || 'General site progress'}
                    </p>
                    <p className="text-micro text-subtle">
                      {update.recorded_by_name} · {relativeTime(update.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-h4 font-semibold tabular text-ink">
                      {Math.round(update.new_progress)}%
                    </span>
                    {moved !== 0 && (
                      <span className="block text-micro font-medium tabular text-healthy">
                        +{moved} pts
                      </span>
                    )}
                  </span>
                </div>

                <p className="mt-2.5 text-base leading-relaxed text-ink">{update.work_completed}</p>

                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar
                    value={update.new_progress}
                    planned={update.previous_progress || null}
                    tone="ink"
                    className="flex-1"
                  />
                  <span className="shrink-0 text-micro tabular text-subtle">
                    from {Math.round(update.previous_progress)}%
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-tiny text-muted">
                  {update.workers_used > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      <span className="tabular text-ink">{update.workers_used}</span> on the task
                    </span>
                  )}
                  {update.photo_ids?.length > 0 && (
                    <span className="tabular">{update.photo_ids.length} photo(s)</span>
                  )}
                </div>

                {update.materials_used?.length > 0 && (
                  <ul className="mt-2.5 flex flex-wrap gap-1.5">
                    {update.materials_used.map((usage, index) => (
                      <li
                        key={`${usage.name}-${index}`}
                        className="rounded-pill border border-line bg-raised px-2.5 py-0.5 text-micro text-muted"
                      >
                        {usage.name} · {formatNumber(usage.quantity, 1)} {usage.unit}
                      </li>
                    ))}
                  </ul>
                )}

                {update.notes && (
                  <p className="mt-2.5 rounded-control bg-raised px-3 py-2 text-tiny leading-relaxed text-muted">
                    {update.notes}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ProgressUpdateSheet
        open={updating}
        onClose={() => setUpdating(false)}
        onSaved={() => {
          reload()
          reloadSite()
        }}
      />
    </div>
  )
}
