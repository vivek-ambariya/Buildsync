import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, Building2, CheckCircle2, ListChecks, RefreshCw, Users,
} from 'lucide-react'

import { adminService } from '@/services'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatINR, formatPercent } from '@/lib/format'
import { ROLE_NAMES } from '@/lib/permissions'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { MetricCard } from '@/components/MetricCard'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { MetricSkeleton, PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DistributionBars } from '@/features/admin/DistributionBars'

const STATUS_TONES = {
  active: 'healthy', completed: 'healthy', planning: 'info',
  at_risk: 'amber', delayed: 'critical', on_hold: 'neutral',
}

const ROLE_TONES = {
  admin: 'amber', project_manager: 'ink', site_engineer: 'info', contractor: 'neutral',
}

export default function AdminOverview() {
  const overview = useAsync(() => adminService.overview(), [])
  const analytics = useAsync(() => adminService.analytics(), [])
  const activity = useAsync(() => adminService.activity({ page_size: 8 }), [])

  const loading = overview.loading || analytics.loading
  const scope = useEnter([loading, Boolean(overview.data)])

  const reloadAll = () => {
    overview.reload()
    analytics.reload()
    activity.reload()
  }

  if (overview.error) {
    return (
      <ErrorState
        title="Unable to load the control centre"
        description={overview.error.message}
        onRetry={reloadAll}
      />
    )
  }

  const data = overview.data
  const stats = analytics.data
  const system = data?.system
  const healthy = system?.state === 'operational'

  // The projects worth an admin's attention: furthest behind plan first.
  const attention = (stats?.project_progress || [])
    .filter((row) => row.health !== 'healthy' || row.overrun_percent >= 7)
    .slice(0, 6)

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Admin control centre"
        description="System overview and platform management."
        actions={
          <Button variant="secondary" onClick={reloadAll} loading={loading}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !data ? (
          Array.from({ length: 6 }).map((_, index) => <MetricSkeleton key={index} />)
        ) : (
          <>
            <div data-enter>
              <Panel interactive className="flex h-full flex-col justify-between p-5">
                <p className="text-tiny font-medium text-muted">System status</p>
                <div className="mt-2.5 flex items-center gap-2.5">
                  {healthy ? (
                    <CheckCircle2 size={22} className="text-healthy" strokeWidth={2} />
                  ) : (
                    <AlertTriangle size={22} className="text-critical" strokeWidth={2} />
                  )}
                  <span
                    className={cn(
                      'font-display text-h3 font-semibold capitalize',
                      healthy ? 'text-healthy' : 'text-critical',
                    )}
                  >
                    {system?.state || 'unknown'}
                  </span>
                </div>
                <p className="mt-4 truncate text-tiny text-subtle">
                  Database {system?.database} · {system?.environment}
                </p>
              </Panel>
            </div>

            <div data-enter>
              <MetricCard
                label="Active users"
                value={data.users.active}
                caption={`${data.users.seen_today} seen today · ${data.users.inactive} deactivated`}
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Total projects"
                value={data.projects.total}
                caption={`${data.projects.completed} completed`}
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Active projects"
                value={data.projects.active}
                tone="info"
                caption="planning, live, or running behind"
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Projects at risk"
                value={data.projects.at_risk}
                tone={data.projects.at_risk > 0 ? 'critical' : 'healthy'}
                rule={data.projects.at_risk > 0 ? 'critical' : 'healthy'}
                caption={
                  data.projects.at_risk > 0
                    ? 'behind plan or overspending'
                    : 'every site is tracking to plan'
                }
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Pending tasks"
                value={data.tasks.pending}
                tone={data.tasks.overdue > 0 ? 'warning' : 'neutral'}
                caption={`${data.tasks.overdue} past their deadline`}
              />
            </div>
          </>
        )}
      </div>

      {/* Distributions + budget */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div data-enter>
          {analytics.loading && !stats ? (
            <PanelSkeleton rows={4} />
          ) : (
            <Panel>
              <PanelHeader
                title="Projects by status"
                description={`${stats.totals.projects} in the portfolio`}
                action={
                  <Link
                    to="/admin/projects"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    All
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              <div className="p-5">
                <DistributionBars
                  rows={(stats.project_distribution || []).map((row) => ({
                    label: row.status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
                    count: row.count,
                    tone: STATUS_TONES[row.status] || 'ink',
                    to: `/admin/projects?status=${row.status}`,
                  }))}
                  emptyLabel="No projects yet"
                />
              </div>
            </Panel>
          )}
        </div>

        <div data-enter>
          {analytics.loading && !stats ? (
            <PanelSkeleton rows={4} />
          ) : (
            <Panel>
              <PanelHeader
                title="Users by role"
                description={`${data?.users.total ?? 0} accounts`}
                action={
                  <Link
                    to="/admin/users"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    Manage
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              <div className="p-5">
                <DistributionBars
                  rows={(stats.user_distribution || [])
                    .filter((row) => row.count)
                    .map((row) => ({
                      label: ROLE_NAMES[row.role] || row.role,
                      count: row.count,
                      tone: ROLE_TONES[row.role] || 'ink',
                      to: `/admin/users?role=${row.role}`,
                    }))}
                  emptyLabel="No accounts yet"
                />
              </div>
            </Panel>
          )}
        </div>

        <div data-enter>
          {loading && !data ? (
            <PanelSkeleton rows={4} />
          ) : (
            <Panel className="flex h-full flex-col">
              <PanelHeader title="Budget overview" description="Across every project" />
              <div className="flex-1 space-y-4 p-5">
                <BudgetRow label="Total planned" value={data.budget.planned} strong />
                <BudgetRow label="Total spent" value={data.budget.spent} />
                <BudgetRow label="Remaining" value={data.budget.remaining} />
                <div className="border-t border-line pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base text-muted">Variance</span>
                    <span
                      className={cn(
                        'font-display text-h4 font-semibold tabular',
                        data.budget.variance >= 0 ? 'text-healthy' : 'text-critical',
                      )}
                    >
                      {data.budget.variance >= 0 ? '+' : '−'}
                      {formatINR(Math.abs(data.budget.variance))}
                    </span>
                  </div>
                  <p className="mt-1 text-tiny text-subtle">
                    {data.budget.variance >= 0
                      ? 'Progress delivered is ahead of money spent.'
                      : 'More has been spent than progress delivered.'}
                  </p>
                  <ProgressBar
                    value={Math.min(100, data.budget.burn_percent)}
                    tone={data.budget.burn_percent > 90 ? 'critical' : data.budget.burn_percent > 75 ? 'warning' : 'healthy'}
                    className="mt-3"
                  />
                  <p className="mt-1.5 text-tiny text-subtle">
                    {formatPercent(data.budget.burn_percent)} of the portfolio budget committed
                  </p>
                </div>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Attention + activity */}
      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-enter className="min-w-0">
          {analytics.loading && !stats ? (
            <PanelSkeleton rows={5} />
          ) : (
            <Panel>
              <PanelHeader
                title="Needs attention"
                description="Ranked by how far behind plan each project is"
                action={
                  <Link
                    to="/admin/ai"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    AI intelligence
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              {attention.length === 0 ? (
                <EmptyState
                  compact
                  icon={CheckCircle2}
                  title="Nothing needs your attention"
                  description="Every project is tracking to plan and inside budget."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map((row, index) => (
                    <li key={row.id}>
                      <Link
                        to={`/project-manager/projects/${row.id}`}
                        className="block px-5 py-3.5 transition-colors duration-150 hover:bg-raised"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">
                            {row.name}
                          </span>
                          <StatusBadge status={row.status} size="sm" />
                        </div>
                        <p className="mt-0.5 truncate text-tiny text-subtle">
                          {row.manager_name} · {row.code}
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <ProgressBar
                            value={row.actual}
                            planned={row.planned}
                            tone={row.health === 'critical' ? 'critical' : row.health === 'warning' ? 'warning' : 'healthy'}
                            delay={0.04 * index}
                            className="flex-1"
                          />
                          <span
                            className={cn(
                              'w-[4.5rem] shrink-0 text-right text-micro font-medium tabular',
                              row.variance <= -12 ? 'text-critical' : row.variance < -4 ? 'text-amber-deep' : 'text-healthy',
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

        <div data-enter>
          {activity.loading && !activity.data ? (
            <PanelSkeleton rows={6} />
          ) : activity.error ? (
            <Panel>
              <ErrorState
                compact
                title="Unable to load activity"
                description={activity.error.message}
                onRetry={activity.reload}
              />
            </Panel>
          ) : (
            <Panel className="flex h-full flex-col">
              <PanelHeader
                title="Recent activity"
                action={
                  <Link
                    to="/admin/activity"
                    className="flex items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
                  >
                    Full log
                    <ArrowRight size={12} />
                  </Link>
                }
              />
              <div className="flex-1 p-5">
                {activity.data.entries.length === 0 ? (
                  <EmptyState compact title="No activity yet" description="Actions appear here as people work." />
                ) : (
                  <ActivityTimeline items={activity.data.entries} />
                )}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Platform totals */}
      {stats && (
        <div data-enter className="mt-4">
          <Panel>
            <PanelHeader title="Platform records" description="Everything BuildSync is holding" />
            <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 lg:grid-cols-7">
              {[
                { label: 'Projects', value: stats.totals.projects, to: '/admin/projects', icon: Building2 },
                { label: 'Tasks', value: stats.totals.tasks, to: '/admin/tasks', icon: ListChecks },
                { label: 'Materials', value: stats.totals.materials, to: '/admin/materials' },
                { label: 'Expenses', value: stats.totals.expenses, to: '/admin/expenses' },
                { label: 'Documents', value: stats.totals.documents, to: '/admin/documents' },
                { label: 'Site updates', value: stats.totals.site_updates, to: '/admin/site-updates' },
                { label: 'Reports', value: stats.totals.reports, to: '/admin/reports' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="border-b border-r border-line px-5 py-4 transition-colors duration-150 last:border-r-0 hover:bg-raised"
                >
                  <dd className="font-display text-h3 font-semibold tabular text-ink">{item.value}</dd>
                  <dt className="mt-0.5 text-tiny text-muted">{item.label}</dt>
                </Link>
              ))}
            </dl>
          </Panel>
        </div>
      )}
    </div>
  )
}

function BudgetRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-base text-muted">{label}</span>
      <span
        className={cn(
          'shrink-0 tabular',
          strong ? 'font-display text-h4 font-semibold text-ink' : 'text-base font-medium text-ink',
        )}
      >
        {formatINR(value)}
      </span>
    </div>
  )
}
