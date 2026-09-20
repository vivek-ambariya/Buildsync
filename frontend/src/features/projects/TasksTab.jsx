import { useMemo, useState } from 'react'
import { ListChecks, Pencil, Plus, Search, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { daysUntil, formatDate, formatPercent, titleise } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Input, Select } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { TaskFormModal } from './TaskFormModal'

const PRIORITY_TONE = {
  critical: 'text-critical',
  high: 'text-amber-deep',
  medium: 'text-muted',
  low: 'text-subtle',
}

export function TasksTab({ project, onChanged }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data, error, loading, reload } = useAsync(
    () => api.tasks.list({ project_id: project.id }),
    [project.id],
  )

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [phase, setPhase] = useState('')
  const [editingTask, setEditingTask] = useState(null)
  const [creating, setCreating] = useState(false)
  const [deletingTask, setDeletingTask] = useState(null)
  const [removing, setRemoving] = useState(false)

  const phases = useMemo(() => (project.milestones || []).map((milestone) => milestone.name), [project])

  const filtered = useMemo(() => {
    let rows = data || []
    const term = query.trim().toLowerCase()
    if (term) rows = rows.filter((task) => task.title.toLowerCase().includes(term) || (task.assignee_name || '').toLowerCase().includes(term))
    if (status) rows = rows.filter((task) => task.status === status)
    if (phase) rows = rows.filter((task) => task.phase === phase)
    return rows
  }, [data, query, status, phase])

  const counts = useMemo(() => {
    const rows = data || []
    return {
      total: rows.length,
      completed: rows.filter((task) => task.status === 'completed').length,
      delayed: rows.filter((task) => task.status === 'delayed').length,
      overdue: rows.filter((task) => task.overdue).length,
    }
  }, [data])

  const setTaskStatus = async (task, nextStatus) => {
    try {
      await api.tasks.update(task.id, { status: nextStatus })
      toast.success('Task updated', `${task.title} — ${titleise(nextStatus)}`)
      reload()
      onChanged?.()
    } catch (err) {
      toast.error('Could not update that task', err.message)
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await api.tasks.remove(deletingTask.id)
      toast.success('Task deleted', deletingTask.title)
      setDeletingTask(null)
      reload()
      onChanged?.()
    } catch (err) {
      toast.error('Could not delete that task', err.message)
    } finally {
      setRemoving(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Task',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-base text-ink">{row.title}</p>
            <p className="truncate text-micro text-subtle">{row.phase}</p>
          </div>
        ),
      },
      {
        key: 'assignee_name',
        header: 'Assigned to',
        width: '170px',
        render: (row) => (
          <div className="flex items-center gap-2">
            {row.assignee ? (
              <Avatar name={row.assignee.name} initials={row.assignee.avatar_initials} size="xs" />
            ) : null}
            <span className={cn('truncate text-base', row.assignee ? 'text-ink' : 'text-subtle')}>
              {row.assignee_name}
            </span>
          </div>
        ),
      },
      {
        key: 'deadline',
        header: 'Deadline',
        width: '130px',
        align: 'right',
        sortValue: (row) => new Date(row.deadline).getTime(),
        render: (row) => {
          const remaining = daysUntil(row.deadline)
          return (
            <div>
              <p className="text-ink">{formatDate(row.deadline, { withYear: false })}</p>
              {row.status !== 'completed' && (
                <p className={cn('text-micro', row.overdue ? 'text-critical' : remaining < 7 ? 'text-amber-deep' : 'text-subtle')}>
                  {remaining < 0 ? `${Math.abs(remaining)}d over` : `${remaining}d left`}
                </p>
              )}
            </div>
          )
        },
      },
      {
        key: 'progress',
        header: 'Progress',
        width: '140px',
        render: (row) => (
          <div>
            <p className="text-tiny tabular text-ink">{formatPercent(row.progress)}</p>
            <ProgressBar
              value={row.progress}
              tone={row.status === 'completed' ? 'healthy' : row.overdue ? 'critical' : 'ink'}
              showPlannedMarker={false}
              className="mt-1.5"
            />
          </div>
        ),
      },
      {
        key: 'priority',
        header: 'Priority',
        width: '90px',
        render: (row) => (
          <span className={cn('text-tiny capitalize', PRIORITY_TONE[row.priority])}>{row.priority}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '120px',
        render: (row) =>
          can('updateTasks') ? (
            <Select
              value={row.status}
              onChange={(event) => setTaskStatus(row, event.target.value)}
              onClick={(event) => event.stopPropagation()}
              className="h-7 !py-0 !pl-2 !pr-7 text-tiny"
              aria-label={`Status of ${row.title}`}
            >
              {['not_started', 'in_progress', 'completed', 'delayed'].map((value) => (
                <option key={value} value={value}>{titleise(value)}</option>
              ))}
            </Select>
          ) : (
            <StatusBadge status={row.status} size="sm" />
          ),
      },
      ...(can('manageTasks')
        ? [
            {
              key: 'actions',
              header: '',
              width: '76px',
              sortable: false,
              render: (row) => (
                <div className="flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setEditingTask(row) }}
                    className="rounded p-1.5 text-subtle transition-colors hover:bg-raised hover:text-ink"
                    aria-label={`Edit ${row.title}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setDeletingTask(row) }}
                    className="rounded p-1.5 text-subtle transition-colors hover:bg-critical-wash hover:text-critical"
                    aria-label={`Delete ${row.title}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

  if (error) return <ErrorState title="We could not load the tasks" description={error.message} onRetry={reload} />

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks or people"
            className="pl-9"
            aria-label="Search tasks"
          />
        </div>
        <Select value={phase} onChange={(event) => setPhase(event.target.value)} className="w-auto" aria-label="Filter by phase">
          <option value="">All phases</option>
          {phases.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto" aria-label="Filter by status">
          <option value="">All statuses</option>
          {['not_started', 'in_progress', 'completed', 'delayed'].map((value) => (
            <option key={value} value={value}>{titleise(value)}</option>
          ))}
        </Select>

        <p className="text-tiny text-muted lg:ml-auto">
          <span className="tabular text-ink">{counts.completed}</span> of{' '}
          <span className="tabular text-ink">{counts.total}</span> complete
          {counts.overdue > 0 && (
            <>
              {' · '}
              <span className="tabular text-critical">{counts.overdue} overdue</span>
            </>
          )}
        </p>

        {can('manageTasks') && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={15} />
            New task
          </Button>
        )}
      </div>

      {loading && !data ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <Panel className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={filtered}
            initialSort={{ key: 'deadline', direction: 'asc' }}
            empty={
              <EmptyState
                icon={ListChecks}
                title={query || status || phase ? 'No tasks match those filters' : 'No tasks yet'}
                description={
                  query || status || phase
                    ? 'Clear the filters to see everything on this project.'
                    : 'Break the build into tasks so progress can be tracked against the schedule.'
                }
                action={
                  can('manageTasks') && !(query || status || phase) ? (
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      <Plus size={15} />
                      Create the first task
                    </Button>
                  ) : null
                }
              />
            }
          />
        </Panel>
      )}

      <TaskFormModal
        open={creating || Boolean(editingTask)}
        task={editingTask}
        project={project}
        phases={phases}
        onClose={() => { setCreating(false); setEditingTask(null) }}
        onSaved={() => {
          setCreating(false)
          setEditingTask(null)
          reload()
          onChanged?.()
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingTask)}
        loading={removing}
        onClose={() => setDeletingTask(null)}
        onConfirm={remove}
        title="Delete this task?"
        confirmLabel="Delete task"
        description={`"${deletingTask?.title}" will be removed and the project's completion recalculated without it.`}
      />
    </div>
  )
}
