import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, Package } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatPercent, titleise } from '@/lib/format'
import { ProgressChart } from '@/charts/ProgressChart'
import { CategoryChart } from '@/charts/CategoryChart'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { AIInsightCard } from '@/components/AIInsightCard'
import { Avatar } from '@/components/ui/Avatar'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ChartSkeleton, PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/States'

export function OverviewTab({ project }) {
  const { data: analytics, loading: loadingSpend } = useAsync(
    () => api.expenses.analytics(project.id),
    [project.id],
  )
  const { data: insights, loading: loadingInsights } = useAsync(
    () => api.ai.insights(project.id),
    [project.id],
  )
  const { data: updates } = useAsync(() => api.siteUpdates.list({ project_id: project.id, limit: 14 }), [project.id])
  const { data: materials } = useAsync(() => api.materials.list({ project_id: project.id }), [project.id])

  // The phase bars come from milestones, which the timeline tab renders in full.
  const phases = project.milestones || []

  const progressSeries = useMemo(() => {
    if (!updates?.length) return []
    const start = new Date(project.start_date)
    const end = new Date(project.end_date)
    const span = Math.max(1, (end - start) / 86_400_000)
    return [...updates]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((update) => {
        const at = new Date(update.date)
        return {
          label: formatDate(update.date, { withYear: false }),
          planned: Math.round(Math.min(100, Math.max(0, ((at - start) / 86_400_000 / span) * 100)) * 10) / 10,
          actual: update.progress_percent,
        }
      })
  }, [updates, project.start_date, project.end_date])

  const lowStock = (materials || []).filter((material) => material.status !== 'healthy')
  const topFindings = (insights?.findings || []).slice(0, 3)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-4">
        {loadingSpend && !updates ? (
          <ChartSkeleton />
        ) : (
          <ProgressChart
            data={progressSeries}
            title="Reported progress against plan"
            description="Each point is a site report, plotted against where the schedule expected the build to be"
            height={300}
          />
        )}

        <Panel>
          <PanelHeader title="Phase progress" description="Share of the build each phase carries" />
          {phases.length === 0 ? (
            <EmptyState compact title="No phases defined" description="Add milestones to break the build into phases." />
          ) : (
            <ul className="divide-y divide-line">
              {phases.map((phase, index) => (
                <li key={phase.id} className="px-5 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base text-ink">{phase.name}</span>
                    <span className="text-tiny text-subtle">
                      {Math.round((phase.weight || 0) * 100)}% of the build
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar
                      value={phase.progress}
                      planned={phase.planned_progress}
                      tone={
                        phase.progress >= (phase.planned_progress ?? 0) - 4
                          ? 'healthy'
                          : phase.progress >= (phase.planned_progress ?? 0) - 15
                            ? 'warning'
                            : 'critical'
                      }
                      delay={index * 0.05}
                      className="flex-1"
                    />
                    <span className="w-12 shrink-0 text-right text-tiny tabular text-ink">
                      {formatPercent(phase.progress)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-micro text-subtle">
                    Planned {formatDate(phase.planned_start, { withYear: false })} – {formatDate(phase.planned_end)}
                    {phase.task_count ? ` · ${phase.task_count} tasks` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {loadingSpend ? <ChartSkeleton /> : <CategoryChart data={analytics?.by_category || []} title="Where the money has gone" />}
      </div>

      <div className="space-y-4">
        <Panel>
          <PanelHeader title="Project team" />
          <ul className="divide-y divide-line">
            {project.manager && <PersonRow person={project.manager} badge="Manager" />}
            {(project.team || []).map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
            {!project.manager && !(project.team || []).length && (
              <li className="px-5 py-6">
                <p className="text-base text-muted">Nobody is assigned to this project yet.</p>
              </li>
            )}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader
            title="Needs attention"
            description={topFindings.length ? `${insights.findings.length} open findings` : undefined}
          />
          {loadingInsights ? (
            <div className="p-5">
              <PanelSkeleton rows={2} title={false} />
            </div>
          ) : topFindings.length === 0 ? (
            <EmptyState
              compact
              icon={AlertTriangle}
              title="Nothing flagged"
              description="No schedule, budget or material risks on this project."
            />
          ) : (
            <div className="space-y-2.5 p-3">
              {topFindings.map((finding) => (
                <AIInsightCard key={finding.id} insight={finding} compact />
              ))}
            </div>
          )}
        </Panel>

        {lowStock.length > 0 && (
          <Panel>
            <PanelHeader title="Stock to reorder" description={`${lowStock.length} materials below a safe level`} />
            <ul className="divide-y divide-line">
              {lowStock.slice(0, 5).map((material) => (
                <li key={material.id} className="flex items-center gap-3 px-5 py-3">
                  <Package size={14} className={material.status === 'critical' ? 'text-critical' : 'text-amber-deep'} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base text-ink">{material.name}</p>
                    <p className="truncate text-micro text-subtle">
                      {material.metrics.days_of_cover} days cover · {material.lead_time_days} day lead time
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-tiny tabular',
                      material.status === 'critical' ? 'text-critical' : 'text-amber-deep',
                    )}
                  >
                    {material.available_qty} {material.unit}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel>
          <PanelHeader title="Recent activity" />
          <div className="p-5">
            <ActivityTimeline items={project.activity || []} />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function PersonRow({ person, badge }) {
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <Avatar name={person.name} initials={person.avatar_initials} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-ink">{person.name}</p>
        <p className="truncate text-micro text-subtle">{person.title || titleise(person.role)}</p>
      </div>
      {badge && (
        <span className="shrink-0 rounded-pill border border-line bg-raised px-2 py-0.5 text-micro text-muted">
          {badge}
        </span>
      )}
    </li>
  )
}
