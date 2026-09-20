import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardList, CloudSun, Plus, Users } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { formatDate, formatDateLong, formatNumber, formatPercent } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { DailyReportWizard } from '@/features/site-ops/DailyReportWizard'
import { SitePageHeader } from '@/features/site-ops/SitePageHeader'

/**
 * The daily record, and the one prompt that matters.
 *
 * If today's report has not gone in, that is the first thing on the screen
 * and it is a full-width target — because the cost of a missing report is
 * paid a week later by someone trying to reconstruct what happened.
 */
export default function DailyReports() {
  const { projectId, project, overview, reload: reloadSite } = useSite()
  const [filing, setFiling] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.reports(projectId) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  if (error) {
    return <ErrorState title="We could not load your reports" description={error.message} onRetry={reload} />
  }

  const reports = data || []
  const filedToday = overview?.report_filed_today

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Daily reports"
        count={reports.length}
        countLabel={`filed on ${project?.name || 'this site'}`}
        action={
          <Button variant="accent" onClick={() => setFiling(true)}>
            <Plus size={15} />
            New
          </Button>
        }
      />

      <section className="mb-5" data-enter>
        {filedToday ? (
          <div className="flex items-center gap-3 rounded-panel border border-healthy/25 bg-healthy-wash px-4 py-3.5">
            <CheckCircle2 size={19} className="shrink-0 text-healthy" />
            <p className="text-base text-healthy">
              Today's report is filed. The project manager has been notified.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFiling(true)}
            className="tap-lg flex w-full items-center gap-3 rounded-panel border border-amber/50 bg-amber-wash px-4 text-left active:opacity-90"
          >
            <ClipboardList size={22} className="shrink-0 text-amber-deep" />
            <span className="flex-1">
              <span className="block text-base font-semibold text-amber-deep">File today's site report</span>
              <span className="block text-tiny text-amber-deep/85">
                {formatDateLong(new Date())} · eight quick steps
              </span>
            </span>
          </button>
        )}
      </section>

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
      ) : reports.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={ClipboardList}
            title="No reports filed yet"
            description="A daily report closes the day: what was built, who was on site, what was used and what went wrong."
            action={
              <Button variant="accent" onClick={() => setFiling(true)}>
                <Plus size={15} />
                File the first report
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" data-enter>
          {reports.map((report) => {
            const hasIssue = Boolean((report.issues || '').trim())
            return (
              <li
                key={report.id}
                className={`rounded-panel border bg-surface p-4 ${hasIssue ? 'rule-left border-amber/40 text-amber' : 'border-line'}`}
              >
                <div className={hasIssue ? 'pl-2.5' : undefined}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-[1.0625rem] font-semibold leading-tight text-ink">
                        {formatDate(report.date)}
                      </p>
                      <p className="mt-0.5 text-micro text-subtle">{report.reported_by_name}</p>
                    </div>
                    <span className="shrink-0 font-display text-h4 font-semibold tabular text-ink">
                      {formatPercent(report.progress_percent, 0)}
                    </span>
                  </div>

                  <p className="mt-2.5 text-base leading-relaxed text-ink">{report.work_completed}</p>

                  <ProgressBar
                    value={report.progress_percent}
                    tone="ink"
                    showPlannedMarker={false}
                    className="mt-3"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-tiny text-muted">
                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      <span className="tabular text-ink">{formatNumber(report.workers_count)}</span> on site
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CloudSun size={12} />
                      {report.weather}
                    </span>
                    {report.photos?.length > 0 && (
                      <span className="tabular">{report.photos.length} photo(s)</span>
                    )}
                  </div>

                  {report.materials_used?.length > 0 && (
                    <ul className="mt-2.5 flex flex-wrap gap-1.5">
                      {report.materials_used.map((usage, index) => (
                        <li
                          key={`${usage.name}-${index}`}
                          className="rounded-pill border border-line bg-raised px-2.5 py-0.5 text-micro text-muted"
                        >
                          {usage.name} · {formatNumber(usage.quantity, 1)} {usage.unit}
                        </li>
                      ))}
                    </ul>
                  )}

                  {hasIssue && (
                    <p className="mt-3 flex items-start gap-2 rounded-control bg-amber-wash/60 px-3 py-2.5 text-tiny leading-relaxed text-amber-deep">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      {report.issues}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <DailyReportWizard
        open={filing}
        onClose={() => setFiling(false)}
        onSubmitted={() => {
          reload()
          reloadSite()
        }}
      />
    </div>
  )
}
