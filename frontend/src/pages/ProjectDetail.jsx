import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Pencil, Sparkles, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { daysUntil, formatDate, formatINR, formatPercent } from '@/lib/format'
import { toneForOverrun, toneForVariance } from '@/lib/tone'
import { useEnter } from '@/animations/useMotion'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Tabs } from '@/components/ui/Tabs'
import { MetricSkeleton, PanelSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'
import { PageHeader } from '@/layouts/PageHeader'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { OverviewTab } from '@/features/projects/OverviewTab'
import { TasksTab } from '@/features/projects/TasksTab'
import { TimelineTab } from '@/features/projects/TimelineTab'
import { MaterialsTab } from '@/features/projects/MaterialsTab'
import { ExpensesTab } from '@/features/projects/ExpensesTab'
import { ProjectDocumentsTab } from '@/features/projects/ProjectDocumentsTab'
import { SiteUpdatesTab } from '@/features/projects/SiteUpdatesTab'
import { ProjectInsightsTab } from '@/features/projects/ProjectInsightsTab'

const TAB_COMPONENTS = {
  overview: OverviewTab,
  tasks: TasksTab,
  timeline: TimelineTab,
  materials: MaterialsTab,
  expenses: ExpensesTab,
  documents: ProjectDocumentsTab,
  'site-updates': SiteUpdatesTab,
  insights: ProjectInsightsTab,
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { can } = useAuth()

  const { data: project, error, loading, reload } = useAsync(
    () => api.projects.get(projectId),
    [projectId],
  )
  const scope = useEnter([projectId, loading, Boolean(project)])

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)

  const tab = searchParams.get('tab') || 'overview'
  const setTab = (value) => setSearchParams(value === 'overview' ? {} : { tab: value }, { replace: true })

  useEffect(() => {
    if (!TAB_COMPONENTS[tab]) setTab('overview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const tabs = useMemo(
    () => [
      { value: 'overview', label: 'Overview' },
      { value: 'tasks', label: 'Tasks', count: project?.counts?.tasks },
      { value: 'timeline', label: 'Timeline' },
      { value: 'materials', label: 'Materials', count: project?.counts?.materials },
      { value: 'expenses', label: 'Expenses' },
      { value: 'documents', label: 'Documents', count: project?.counts?.documents },
      { value: 'site-updates', label: 'Site updates', count: project?.counts?.site_updates },
      { value: 'insights', label: 'AI insights' },
    ],
    [project],
  )

  const remove = async () => {
    setRemoving(true)
    try {
      await api.projects.remove(projectId)
      toast.success('Project deleted', project.name)
      navigate('/app/projects')
    } catch (err) {
      toast.error('Could not delete that project', err.message)
      setRemoving(false)
      setDeleting(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        title="We could not open that project"
        description={error.message}
        onRetry={reload}
      />
    )
  }

  if (loading && !project) {
    return (
      <div>
        <PanelSkeleton rows={2} title={false} className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <MetricSkeleton key={index} />
          ))}
        </div>
      </div>
    )
  }

  const schedule = project.metrics?.schedule
  const budget = project.metrics?.budget
  const variance = schedule?.variance ?? 0
  const tone = toneForVariance(variance)
  const remaining = daysUntil(project.end_date)
  const TabComponent = TAB_COMPONENTS[tab] || OverviewTab

  return (
    <div ref={scope}>
      <PageHeader
        backTo="/app/projects"
        backLabel="Projects"
        eyebrow={`${project.code} · ${project.category} · ${project.location}`}
        title={project.name}
        description={project.description}
        actions={
          <>
            <ButtonLink to="/app/assistant" variant="secondary">
              <Sparkles size={14} />
              Ask about this project
            </ButtonLink>
            {can('manageProjects') && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil size={14} />
                  Edit
                </Button>
                {can('manageUsers') && (
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label="Delete project">
                    <Trash2 size={15} />
                  </Button>
                )}
              </>
            )}
          </>
        }
      />

      {/* Headline position: one row that answers "how is this going?" */}
      <Panel className={cn('rule-left mb-4', tone.rule)} data-enter>
        <div className="grid gap-5 p-5 pl-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-tiny text-muted">Completion</p>
              <StatusBadge status={project.status} size="sm" pulse={project.status === 'at_risk'} />
            </div>
            <p className="mt-1.5 font-display text-metric tabular text-ink">
              {formatPercent(schedule?.actual_progress, 1)}
            </p>
            <ProgressBar
              value={schedule?.actual_progress ?? 0}
              planned={schedule?.planned_progress}
              tone={tone.bar}
              className="mt-2.5"
            />
            <p className="mt-2 text-micro text-subtle">
              Plan says {formatPercent(schedule?.planned_progress, 1)} by today
            </p>
          </div>

          <Figure
            label="Schedule variance"
            value={`${variance > 0 ? '+' : ''}${variance.toFixed(1)} pts`}
            tone={tone.key}
            caption={
              schedule?.delay_days
                ? `Forecast finish ${formatDate(schedule.forecast_end)}, ${schedule.delay_days} days late`
                : `Forecast finish ${formatDate(schedule?.forecast_end)}, on time`
            }
          />

          <Figure
            label="Budget"
            value={formatINR(project.budget)}
            caption={`${formatINR(budget?.spent)} committed · ${formatINR(budget?.remaining)} left`}
            extra={
              <ProgressBar
                value={budget?.burn_percent ?? 0}
                tone={toneForOverrun(budget?.overrun_percent).bar}
                showPlannedMarker={false}
                className="mt-2.5"
              />
            }
          />

          <Figure
            label="Deadline"
            value={formatDate(project.end_date)}
            caption={
              remaining < 0
                ? `${Math.abs(remaining)} days past the contract date`
                : `${remaining} days remaining · started ${formatDate(project.start_date)}`
            }
            tone={remaining < 45 ? 'critical' : undefined}
          />
        </div>
      </Panel>

      <div data-enter>
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-5" />
        <TabComponent project={project} onChanged={reload} />
      </div>

      <ProjectFormModal
        open={editing}
        project={project}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false)
          reload()
        }}
      />

      <ConfirmDialog
        open={deleting}
        loading={removing}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        title={`Delete ${project.name}?`}
        confirmLabel="Delete project"
        description={`This removes the project along with its ${project.counts?.tasks || 0} tasks, ${project.counts?.materials || 0} material records, ${project.counts?.documents || 0} documents and every expense logged against it. This cannot be undone.`}
      />
    </div>
  )
}

function Figure({ label, value, caption, tone, extra }) {
  return (
    <div>
      <p className="text-tiny text-muted">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-display text-metric tabular',
          tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-amber-deep' : 'text-ink',
        )}
      >
        {value}
      </p>
      {extra}
      {caption && <p className="mt-2 text-micro leading-relaxed text-subtle">{caption}</p>}
    </div>
  )
}
