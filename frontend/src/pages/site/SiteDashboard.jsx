import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, Package, Sun, Users } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { formatDateLong, formatNumber, greeting } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useSite } from '@/features/site-ops/SiteContext'
import { QuickActions } from '@/features/site-ops/QuickActions'
import { TaskCard } from '@/features/site-ops/TaskCard'
import { AssistantLauncher } from '@/features/site-ops/SiteAssistant'
import { WorkforceSheet } from '@/features/site-ops/WorkforceSheet'

/**
 * The site dashboard answers one question: what do I need to do on site today.
 *
 * Nothing on it is portfolio information. There is no budget, no spend curve
 * and no comparison against other projects, because none of that changes what
 * the person does in the next hour. The order is the order of the morning:
 * the count of the day, the actions, then the work itself.
 */
export default function SiteDashboard() {
  const { user } = useAuth()
  const { overview, loading, error, reload, project } = useSite()
  const scope = useEnter([loading, Boolean(overview)])
  const [recordingWorkforce, setRecordingWorkforce] = useState(false)

  if (error) {
    return <ErrorState title="We could not load your site" description={error.message} onRetry={() => reload()} />
  }

  if (!loading && !project) {
    return (
      <EmptyState
        icon={Sun}
        title="No site assigned yet"
        description="Once a project manager adds you to a site, everything you need for the day appears here."
      />
    )
  }

  const summary = overview?.summary
  const workforce = overview?.workforce
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div ref={scope}>
      <header className="mb-5" data-enter>
        <h1 className="font-display text-h2 leading-tight text-ink">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-body text-muted">{formatDateLong(new Date())}</p>
        {project && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} size="sm" />
            <span className="text-tiny text-subtle">
              {Math.round(project.actual_progress || 0)}% complete
              {overview?.schedule && overview.schedule.variance < -4 && (
                <span className="ml-1.5 text-amber-deep">
                  · {Math.abs(overview.schedule.variance).toFixed(1)} pts behind plan
                </span>
              )}
            </span>
          </div>
        )}
      </header>

      {/* Today's summary */}
      <section className="mb-5" data-enter aria-label="Today's summary">
        {loading && !overview ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-panel border border-line p-4">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-3 h-7 w-10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat label="Today's tasks" value={summary.tasks} />
            <Stat label="Completed" value={summary.completed} tone="healthy" icon={CheckCircle2} />
            <Stat label="Pending" value={summary.pending} tone={summary.pending > 0 ? 'ink' : 'healthy'} />
            <Stat
              label="Issues"
              value={summary.issues}
              tone={summary.issues > 0 ? 'critical' : 'healthy'}
              icon={summary.issues > 0 ? AlertTriangle : undefined}
              to={summary.issues > 0 ? '/site/issues' : undefined}
            />
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mb-6" data-enter aria-label="Quick actions">
        <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-muted">Quick actions</h2>
        <QuickActions onChanged={() => reload()} columns={2} className="sm:!grid-cols-3" />
      </section>

      {/* Today's work */}
      <section className="mb-6" data-enter aria-label="Today's work">
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <h2 className="text-tiny font-semibold uppercase tracking-[0.05em] text-muted">Today's work</h2>
          <Link
            to="/site/tasks"
            className="flex shrink-0 items-center gap-1 text-tiny font-medium text-muted transition-colors hover:text-ink"
          >
            All my tasks
            <ArrowRight size={12} />
          </Link>
        </div>

        {loading && !overview ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-panel border border-line p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-3 h-3 w-1/3" />
                <Skeleton className="mt-5 h-11 w-full" />
              </div>
            ))}
          </div>
        ) : overview.tasks_today.length === 0 ? (
          <div className="rounded-panel border border-line bg-surface">
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Nothing scheduled for today"
              description="No tasks are due and nothing is mid-flight. Anything you do get to can still be recorded as progress."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {overview.tasks_today.slice(0, 4).map((task) => (
              <TaskCard key={task.id} task={task} onChanged={() => reload()} compact />
            ))}
            {overview.tasks_today.length > 4 && (
              <Link
                to="/site/tasks"
                className="tap flex items-center justify-center rounded-panel border border-dashed border-line-strong text-base font-medium text-muted"
              >
                {overview.tasks_today.length - 4} more today
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Workforce */}
      <section className="mb-6" data-enter aria-label="Workforce">
        <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-muted">Workers today</h2>
        {workforce ? (
          <div className="rounded-panel border border-line bg-surface p-4">
            <div className="grid grid-cols-3 gap-3">
              <Figure label="On the books" value={formatNumber(workforce.total)} />
              <Figure label="Present" value={formatNumber(workforce.present)} tone="text-healthy" />
              <Figure label="Absent" value={formatNumber(workforce.absent)} tone={workforce.absent > 0 ? 'text-critical' : undefined} />
            </div>
            {workforce.crews?.length > 0 && (
              <ul className="mt-3.5 flex flex-wrap gap-1.5 border-t border-line pt-3.5">
                {workforce.crews.map((crew, index) => (
                  <li
                    key={`${crew.team}-${index}`}
                    className="rounded-pill border border-line bg-raised px-2.5 py-1 text-micro text-muted"
                  >
                    {crew.team} · {crew.present}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" className="mt-3.5 w-full" onClick={() => setRecordingWorkforce(true)}>
              <Users size={15} />
              Update headcount
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRecordingWorkforce(true)}
            className="tap-lg flex w-full items-center gap-3 rounded-panel border border-dashed border-line-strong px-4 text-left active:bg-raised"
          >
            <Users size={20} className="shrink-0 text-subtle" />
            <span>
              <span className="block text-base font-medium text-ink">Headcount not recorded today</span>
              <span className="block text-tiny text-subtle">Tap to log who turned up</span>
            </span>
          </button>
        )}
      </section>

      {/* Anything that needs attention */}
      {(overview?.materials_low?.length > 0 || overview?.open_issues?.length > 0) && (
        <section className="mb-6 grid gap-4 lg:grid-cols-2" data-enter>
          {overview.materials_low.length > 0 && (
            <AttentionList
              title="Materials running low"
              to="/site/materials"
              icon={Package}
              items={overview.materials_low.map((material) => ({
                id: material.id,
                title: material.name,
                detail: `${formatNumber(material.available_qty, 1)} ${material.unit} on site · ${
                  material.metrics?.days_of_cover >= 999
                    ? 'no consumption yet'
                    : `${Math.round(material.metrics?.days_of_cover || 0)} days of cover`
                }`,
                status: material.status,
              }))}
            />
          )}
          {overview.open_issues.length > 0 && (
            <AttentionList
              title="Open issues"
              to="/site/issues"
              icon={AlertTriangle}
              items={overview.open_issues.map((issue) => ({
                id: issue.id,
                title: issue.title,
                detail: issue.description,
                status: issue.severity,
              }))}
            />
          )}
        </section>
      )}

      <div data-enter className="space-y-2.5">
        <AssistantLauncher />
        <Link
          to="/site/photos"
          className="tap flex w-full items-center gap-2.5 rounded-panel border border-line bg-surface px-4 text-base text-muted active:bg-raised"
        >
          <Camera size={17} className="shrink-0 text-subtle" />
          <span className="flex-1">Site photo gallery</span>
          <ArrowRight size={14} className="text-subtle" />
        </Link>
      </div>

      <WorkforceSheet
        open={recordingWorkforce}
        existing={workforce}
        onClose={() => setRecordingWorkforce(false)}
        onSaved={() => reload()}
      />
    </div>
  )
}

const STAT_TONE = {
  ink: 'text-ink',
  healthy: 'text-healthy',
  critical: 'text-critical',
}

function Stat({ label, value, tone = 'ink', icon: Icon, to }) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-tiny font-medium text-muted">
        {Icon && <Icon size={12} className={STAT_TONE[tone]} />}
        {label}
      </p>
      <p className={cn('mt-1.5 font-display text-metric font-semibold tabular', STAT_TONE[tone])}>{value}</p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className="rounded-panel border border-line bg-surface p-4 transition-colors active:bg-raised">
        {body}
      </Link>
    )
  }
  return <div className="rounded-panel border border-line bg-surface p-4">{body}</div>
}

function Figure({ label, value, tone }) {
  return (
    <div>
      <p className="text-micro font-medium uppercase tracking-[0.05em] text-subtle">{label}</p>
      <p className={cn('mt-1 font-display text-h3 font-semibold tabular text-ink', tone)}>{value}</p>
    </div>
  )
}

function AttentionList({ title, items, to, icon: Icon }) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-tiny font-semibold uppercase tracking-[0.05em] text-muted">
          <Icon size={13} />
          {title}
        </h2>
        <Link to={to} className="text-tiny font-medium text-muted transition-colors hover:text-ink">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {items.slice(0, 4).map((item) => (
          <li key={item.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-base font-medium text-ink">{item.title}</p>
              <StatusBadge status={item.status} size="sm" className="shrink-0" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-tiny leading-snug text-muted">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
