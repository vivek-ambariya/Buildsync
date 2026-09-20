import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatPercent } from '@/lib/format'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const DAY = 86_400_000

/**
 * A phase timeline on a shared date axis.
 *
 * Each phase gets two bars: the contract plan as a hollow outline, and what
 * the site has actually built as a solid fill inside it. Where the solid bar
 * stops short of today's line, that gap is the delay — which is the whole
 * point of putting them on the same row rather than in two tables.
 */
export function TimelineTab({ project }) {
  const { data, error, loading, reload } = useAsync(() => api.projects.timeline(project.id), [project.id])

  const model = useMemo(() => {
    if (!data?.milestones?.length) return null

    const start = new Date(data.project.start_date).getTime()
    const end = new Date(data.project.end_date).getTime()
    const span = Math.max(DAY, end - start)
    const position = (value) => ((new Date(value).getTime() - start) / span) * 100

    const months = []
    const cursor = new Date(start)
    cursor.setDate(1)
    while (cursor.getTime() <= end) {
      const at = position(cursor)
      if (at >= 0 && at <= 100) {
        months.push({
          key: cursor.toISOString(),
          left: at,
          label: cursor.toLocaleDateString('en-IN', { month: 'short' }),
          year: cursor.getMonth() === 0 || months.length === 0 ? cursor.getFullYear() : null,
        })
      }
      cursor.setMonth(cursor.getMonth() + (span > 500 * DAY ? 2 : 1))
    }

    const rows = data.milestones.map((milestone) => {
      const plannedLeft = Math.max(0, position(milestone.planned_start))
      const plannedRight = Math.min(100, position(milestone.planned_end))
      const plannedWidth = Math.max(1.2, plannedRight - plannedLeft)
      const actualLeft = milestone.actual_start ? Math.max(0, position(milestone.actual_start)) : plannedLeft
      const actualWidth = (plannedWidth * (milestone.progress || 0)) / 100

      const planned = milestone.planned_progress ?? 0
      const progress = milestone.progress ?? 0
      const drift = planned - progress
      const notDueYet = planned === 0 && progress === 0

      return {
        ...milestone,
        plannedLeft,
        plannedWidth,
        actualLeft,
        actualWidth,
        notDueYet,
        tone: notDueYet ? 'pending' : drift <= 4 ? 'healthy' : drift <= 15 ? 'warning' : 'critical',
      }
    })

    return { rows, months, todayLeft: Math.max(0, Math.min(100, position(new Date()))) }
  }, [data])

  if (error) return <ErrorState title="We could not load the timeline" description={error.message} onRetry={reload} />
  if (loading && !data) return <PanelSkeleton rows={5} />
  if (!model) {
    return (
      <Panel>
        <EmptyState
          icon={CalendarRange}
          title="No phases defined yet"
          description="The timeline is built from the project's milestones. Add them to see planned against actual."
        />
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Construction timeline"
          description={`${formatDate(data.project.start_date)} to ${formatDate(data.project.end_date)}`}
          action={
            <div className="flex items-center gap-4 text-tiny text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm border border-line-strong bg-line/70" aria-hidden />
                Planned
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-sm bg-ink" aria-hidden />
                Built
              </span>
            </div>
          }
        />

        <div className="overflow-x-auto p-5">
          <div className="min-w-[46rem]">
            {/* Month axis */}
            <div className="relative mb-2 ml-[8.5rem] h-5 border-b border-line">
              {model.months.map((month) => (
                <span
                  key={month.key}
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-micro text-subtle"
                  style={{ left: `${month.left}%` }}
                >
                  {month.label}
                  {month.year && <span className="ml-1 text-line-strong">{String(month.year).slice(2)}</span>}
                </span>
              ))}
            </div>

            <div className="relative">
              {/* Today marker runs the height of the chart */}
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-10 ml-[8.5rem] w-px bg-amber"
                style={{ left: `calc((100% - 8.5rem) * ${model.todayLeft / 100})` }}
                aria-hidden
              >
                <span className="absolute -top-0.5 left-1 whitespace-nowrap text-micro font-medium text-amber-deep">
                  today
                </span>
              </div>

              <ul className="space-y-0.5">
                {model.rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 rounded-control py-2.5 transition-colors hover:bg-raised">
                    <div className="w-[8rem] shrink-0 pl-1">
                      <p className="truncate text-base text-ink">{row.name}</p>
                      <p className="text-micro text-subtle">
                        {row.task_count} {row.task_count === 1 ? 'task' : 'tasks'}
                      </p>
                    </div>

                    <div className="relative h-8 flex-1">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 rounded-sm border border-line-strong bg-line/70"
                        style={{ left: `${row.plannedLeft}%`, width: `${row.plannedWidth}%`, height: 18 }}
                        title={`Planned ${formatDate(row.planned_start)} – ${formatDate(row.planned_end)}`}
                      />
                      <div
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 rounded-sm',
                          row.tone === 'critical'
                            ? 'bg-critical'
                            : row.tone === 'warning'
                              ? 'bg-amber'
                              : row.tone === 'pending'
                                ? 'bg-line-strong'
                                : 'bg-healthy',
                        )}
                        style={{ left: `${row.actualLeft}%`, width: `${row.actualWidth}%`, height: 18 }}
                        title={`${formatPercent(row.progress)} built`}
                      />
                      {row.progress > 0 && row.actualWidth > 7 && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 px-1.5 text-micro font-medium tabular text-white"
                          style={{ left: `${row.actualLeft}%` }}
                        >
                          {Math.round(row.progress)}%
                        </span>
                      )}
                    </div>

                    <span
                      className={cn(
                        'w-14 shrink-0 text-right text-tiny tabular',
                        row.tone === 'critical'
                          ? 'text-critical'
                          : row.tone === 'warning'
                            ? 'text-amber-deep'
                            : row.tone === 'pending'
                              ? 'text-subtle'
                              : 'text-healthy',
                      )}
                    >
                      {formatPercent(row.progress)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Phase detail" description="Dates as contracted, against what the site reports" />
        <div className="divide-y divide-line">
          {model.rows.map((row) => (
            <div key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto]">
              <div className="min-w-0">
                <p className="text-base font-medium text-ink">{row.name}</p>
                <p className="mt-0.5 text-tiny text-muted">
                  {row.tasks?.length
                    ? `${row.tasks.filter((task) => task.status === 'completed').length} of ${row.tasks.length} tasks closed`
                    : 'No tasks in this phase'}
                </p>
              </div>
              <Cell label="Planned" value={`${formatDate(row.planned_start, { withYear: false })} – ${formatDate(row.planned_end)}`} />
              <Cell label="Started" value={row.actual_start ? formatDate(row.actual_start) : 'Not started'} />
              <Cell
                label="Built"
                value={formatPercent(row.progress)}
                tone={row.tone}
                align="right"
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function Cell({ label, value, tone, align }) {
  return (
    <div className={cn('sm:w-44', align === 'right' && 'sm:w-20 sm:text-right')}>
      <p className="text-micro text-subtle">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base tabular',
          tone === 'critical'
            ? 'text-critical'
            : tone === 'warning'
              ? 'text-amber-deep'
              : tone === 'pending'
                ? 'text-muted'
                : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  )
}
