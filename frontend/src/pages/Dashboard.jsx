import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Hammer, RefreshCw, Sparkles } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDateLong, formatINR, formatPercent, greeting } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { ProgressChart } from '@/charts/ProgressChart'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { AIInsightCard } from '@/components/AIInsightCard'
import { MetricCard } from '@/components/MetricCard'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ChartSkeleton, MetricSkeleton, PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync(() => api.dashboard.get(), [])
  const scope = useEnter([loading, Boolean(data)])

  const spark = useMemo(
    () => (data?.progress_series || []).map((point) => ({ value: point.actual })),
    [data],
  )

  if (error) {
    return (
      <ErrorState
        title="We could not load the dashboard"
        description={error.message}
        onRetry={reload}
      />
    )
  }

  const summary = data?.summary
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div ref={scope}>
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-enter>
        <div>
          <h1 className="font-display text-h2 text-ink">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-body text-muted">{formatDateLong(new Date())}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={reload} loading={loading}>
            <RefreshCw size={14} />
            Refresh
          </Button>
          <ButtonLink to="/app/assistant" variant="primary">
            <Sparkles size={14} />
            Ask BuildSync
          </ButtonLink>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
          : (
            <>
              <div data-enter>
                <MetricCard
                  label="Active projects"
                  value={summary.active_projects}
                  caption={`of ${data.project_health.length} in the portfolio`}
                />
              </div>
              <div data-enter>
                <MetricCard
                  label="Projects at risk"
                  value={summary.at_risk_projects}
                  tone={summary.at_risk_projects > 0 ? 'critical' : 'healthy'}
                  rule={summary.at_risk_projects > 0 ? 'critical' : 'healthy'}
                  caption={
                    summary.at_risk_projects > 0
                      ? 'behind plan or overspending'
                      : 'every site is tracking to plan'
                  }
                />
              </div>
              <div data-enter>
                <MetricCard
                  label="Overall progress"
                  value={summary.overall_progress}
                  format={(value) => `${value.toFixed(1)}%`}
                  trend={summary.trends?.overall_progress}
                  trendLabel="pts this week"
                  spark={spark}
                  caption="across live sites"
                />
              </div>
              <div data-enter>
                <MetricCard
                  label="Budget under management"
                  value={summary.total_budget}
                  format={(value) => formatINR(value)}
                  caption={`${formatINR(summary.total_spent)} committed · ${formatPercent(
                    (summary.total_spent / summary.total_budget) * 100,
                  )}`}
                />
              </div>
            </>
          )}
      </div>

      {/* Health + progress */}
      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-enter className="min-w-0">
          {loading && !data ? (
            <ChartSkeleton />
          ) : (
            <ProgressChart
              data={data.progress_series}
              title="Portfolio progress"
              description="Mean completion across every live site, against where the schedules say they should be"
              height={320}
              fill
            />
          )}
        </div>

        <div data-enter>
          {loading && !data ? (
            <PanelSkeleton rows={5} />
          ) : (
            <Panel className="flex h-full flex-col">
              <PanelHeader
                title="Project health"
                description="Completion against the planned curve"
                action={
                  <Link
                    to="/app/projects"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    All projects
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              {data.project_health.length === 0 ? (
                <EmptyState
                  compact
                  icon={Building2}
                  title="No projects yet"
                  description="Create your first construction project to start tracking progress."
                />
              ) : (
                <ul className="flex-1 divide-y divide-line">
                  {data.project_health.map((row, index) => (
                    <li key={row.id}>
                      <Link
                        to={`/app/projects/${row.id}`}
                        className="block px-5 py-3 transition-colors duration-150 hover:bg-raised"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate text-base text-ink">{row.name}</span>
                          <span className="shrink-0 font-display text-[0.9375rem] font-semibold tabular text-ink">
                            {formatPercent(row.progress)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <ProgressBar
                            value={row.progress}
                            planned={row.planned}
                            tone={row.health === 'critical' ? 'critical' : row.health === 'warning' ? 'warning' : 'healthy'}
                            delay={0.05 * index}
                            className="flex-1"
                          />
                          <span
                            className={cn(
                              'w-16 shrink-0 text-right text-micro font-medium tabular',
                              row.variance <= -12
                                ? 'text-critical'
                                : row.variance < -4
                                  ? 'text-amber-deep'
                                  : 'text-healthy',
                            )}
                          >
                            {row.variance > 0 ? '+' : ''}
                            {row.variance.toFixed(1)} pts
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>

      {/* Intelligence + activity */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section data-enter>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-h4 text-ink">Project intelligence</h2>
              <p className="mt-0.5 text-tiny text-muted">
                {data?.insight_counts
                  ? `${data.insight_counts.total} open findings · ${data.insight_counts.high} high severity`
                  : 'Ranked by how much each finding is costing you'}
              </p>
            </div>
            <Link
              to="/app/insights"
              className="flex shrink-0 items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
            >
              All findings
              <ArrowRight size={12} />
            </Link>
          </div>

          {loading && !data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PanelSkeleton rows={2} title={false} />
              <PanelSkeleton rows={2} title={false} />
            </div>
          ) : data.insights.length === 0 ? (
            <Panel>
              <EmptyState
                compact
                icon={Sparkles}
                title="Nothing needs your attention"
                description="No schedule, budget or material risks were detected across the portfolio."
              />
            </Panel>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.insights.map((insight) => (
                <AIInsightCard key={insight.id} insight={insight} compact />
              ))}
            </div>
          )}
        </section>

        <div data-enter>
          {loading && !data ? (
            <PanelSkeleton rows={6} />
          ) : (
            <Panel className="flex h-full flex-col">
              <PanelHeader
                title="Recent activity"
                action={
                  <Link
                    to="/app/site-updates"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    Site updates
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              <div className="flex-1 p-5">
                <ActivityTimeline items={data.activity} />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
