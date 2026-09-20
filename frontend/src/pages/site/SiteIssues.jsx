import { useMemo, useState } from 'react'
import { AlertTriangle, Check, MapPin, Plus } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { formatDate, relativeTime, titleise } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { IssueSheet } from '@/features/site-ops/IssueSheet'
import { PhotoLightbox } from '@/features/site-ops/PhotoPicker'
import { FilterStrip, SitePageHeader } from '@/features/site-ops/SitePageHeader'

/**
 * What is holding the work up.
 *
 * Severity is the left-edge rule, so the list scans as a column of urgency
 * before a single word is read. An issue the person raised themselves can be
 * closed from here — they are the one who will see it clear.
 */
export default function SiteIssues() {
  const { projectId, project, reload: reloadSite } = useSite()
  const { can, user } = useAuth()
  const [filter, setFilter] = useState('open')
  const [reporting, setReporting] = useState(false)
  const [viewing, setViewing] = useState(null)

  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.issues({ project_id: projectId }) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  const issues = data || []
  const counts = useMemo(
    () => ({
      open: issues.filter((issue) => issue.status !== 'resolved').length,
      resolved: issues.filter((issue) => issue.status === 'resolved').length,
      all: issues.length,
    }),
    [issues],
  )
  const visible = useMemo(() => {
    const rows =
      filter === 'open'
        ? issues.filter((issue) => issue.status !== 'resolved')
        : filter === 'resolved'
          ? issues.filter((issue) => issue.status === 'resolved')
          : issues
    const rank = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...rows].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))
  }, [issues, filter])

  if (error) {
    return <ErrorState title="We could not load site issues" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Issues"
        count={counts.open}
        countLabel={`open on ${project?.name || 'this site'}`}
        action={
          can('reportIssues') && (
            <Button variant="accent" onClick={() => setReporting(true)}>
              <Plus size={15} />
              Report
            </Button>
          )
        }
      >
        <FilterStrip
          className="mt-3.5"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'resolved', label: 'Resolved', count: counts.resolved },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </SitePageHeader>

      {loading && !data ? (
        <div className="space-y-3" data-enter>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={AlertTriangle}
            title={filter === 'open' ? 'Nothing is blocking the work' : 'Nothing here'}
            description={
              filter === 'open'
                ? 'No open issues on this site. Raise one the moment something holds the work up — it reaches the project manager straight away.'
                : 'No issues match this filter.'
            }
            action={
              can('reportIssues') && filter === 'open' ? (
                <Button variant="secondary" onClick={() => setReporting(true)}>
                  <Plus size={15} />
                  Report an issue
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" data-enter>
          {visible.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              canClose={issue.reported_by === user?.id || can('resolveIssues')}
              onChanged={() => {
                reload()
                reloadSite()
              }}
              onViewPhoto={setViewing}
            />
          ))}
        </ul>
      )}

      <IssueSheet
        open={reporting}
        onClose={() => setReporting(false)}
        onSaved={() => {
          reload()
          reloadSite()
        }}
      />
      <PhotoLightbox photo={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}

const SEVERITY_RULE = {
  critical: 'rule-left border-critical/40 text-critical',
  high: 'rule-left border-critical/25 text-critical',
  medium: 'rule-left border-amber/40 text-amber',
  low: 'border-line',
}

function IssueRow({ issue, canClose, onChanged, onViewPhoto }) {
  const toast = useToast()
  const [closing, setClosing] = useState(false)
  const resolved = issue.status === 'resolved'

  const resolve = async () => {
    setClosing(true)
    try {
      await api.site.updateIssue(issue.id, { status: 'resolved' })
      toast.success('Issue closed', issue.title)
      onChanged?.()
    } catch (err) {
      toast.error('Could not close it', err.message)
    } finally {
      setClosing(false)
    }
  }

  return (
    <li
      className={cn(
        'rounded-panel border bg-surface p-4',
        resolved ? 'border-line opacity-75' : SEVERITY_RULE[issue.severity] || 'border-line',
      )}
    >
      <div className={cn(!resolved && issue.severity !== 'low' && 'pl-2.5')}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 font-display text-[1.0625rem] font-semibold leading-tight text-ink">
            {resolved && <Check size={15} className="mr-1.5 inline text-healthy" />}
            {issue.title}
          </h3>
          <StatusBadge
            status={issue.severity}
            label={`${titleise(issue.severity)}`}
            size="sm"
            className="shrink-0"
          />
        </div>

        <p className="mt-2 text-base leading-relaxed text-ink">{issue.description}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-tiny text-muted">
          <span>{issue.reported_by_name} · {relativeTime(issue.created_at)}</span>
          {issue.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {issue.location}
            </span>
          )}
          {issue.expected_resolution && (
            <span>Expected {formatDate(issue.expected_resolution, { withYear: false })}</span>
          )}
        </div>

        {issue.photos?.length > 0 && (
          <ul className="mt-3 flex gap-2">
            {issue.photos.map((photo) => (
              <li key={photo.id}>
                <button type="button" onClick={() => onViewPhoto(photo)} className="block">
                  <img
                    src={api.site.photoUrl(photo.id)}
                    alt={photo.description || 'Issue photo'}
                    loading="lazy"
                    className="h-16 w-16 rounded-control border border-line object-cover"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}

        {resolved ? (
          <p className="mt-3 text-tiny text-healthy">
            Closed by {issue.resolved_by_name} · {relativeTime(issue.resolved_at)}
          </p>
        ) : (
          canClose && (
            <Button variant="secondary" className="mt-3.5 w-full" loading={closing} onClick={resolve}>
              <Check size={15} />
              Mark resolved
            </Button>
          )
        )}
      </div>
    </li>
  )
}
