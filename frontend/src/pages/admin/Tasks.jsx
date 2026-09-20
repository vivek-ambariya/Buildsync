import { useMemo, useState } from 'react'
import { ListChecks, Pencil, Trash2 } from 'lucide-react'

import { projectService, taskService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TaskFormModal } from '@/features/projects/TaskFormModal'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RowMenu } from '@/features/admin/RowMenu'

const STATUSES = ['not_started', 'in_progress', 'completed', 'delayed']

export default function AdminTasks() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const [status, setStatus] = useState('')
  const [project, setProject] = useState('')

  const { data, error, loading, reload } = useAsync(
    () =>
      taskService.list({
        q: debounced || undefined,
        status: status || undefined,
        project_id: project || undefined,
      }),
    [debounced, status, project],
  )
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const remove = async (task) => {
    setBusy(true)
    try {
      await taskService.remove(task.id)
      toast.success('Task deleted.')
      setConfirm(null)
      reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot delete tasks.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Task',
        value: (row) => row.title,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.title}</span>
            <span className="block truncate text-tiny text-subtle">
              {row.project_name} · {row.phase}
            </span>
          </div>
        ),
      },
      {
        key: 'assignee_name',
        header: 'Assignee',
        value: (row) => row.assignee_name,
        render: (row) =>
          row.assignee ? (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar name={row.assignee.name} initials={row.assignee.avatar_initials} size="sm" />
              <span className="truncate text-muted">{row.assignee.name}</span>
            </div>
          ) : (
            <span className="text-subtle">Unassigned</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        value: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} size="sm" />,
      },
      {
        key: 'priority',
        header: 'Priority',
        value: (row) => row.priority,
        render: (row) => <StatusBadge status={row.priority} size="sm" />,
      },
      {
        key: 'progress',
        header: 'Progress',
        width: '9rem',
        sortValue: (row) => row.progress || 0,
        render: (row) => (
          <div>
            <span className="text-tiny tabular text-ink">{Math.round(row.progress || 0)}%</span>
            <ProgressBar
              value={row.progress || 0}
              tone={row.status === 'delayed' ? 'critical' : row.progress >= 100 ? 'healthy' : 'ink'}
              className="mt-1.5"
              showPlannedMarker={false}
            />
          </div>
        ),
      },
      {
        key: 'deadline',
        header: 'Deadline',
        align: 'right',
        sortValue: (row) => row.deadline || '',
        render: (row) => (
          <span
            className={cn(
              'whitespace-nowrap text-tiny',
              row.overdue ? 'font-medium text-critical' : 'text-muted',
            )}
          >
            {formatDate(row.deadline)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        width: '3rem',
        align: 'right',
        render: (row) => (
          <RowMenu
            label={`Actions for ${row.title}`}
            items={[
              { label: 'Edit task', icon: Pencil, onSelect: () => setEditing(row) },
              { label: 'Delete task', icon: Trash2, destructive: true, onSelect: () => setConfirm(row) },
            ]}
          />
        ),
      },
    ],
    [],
  )

  const overdue = (data || []).filter((task) => task.overdue).length
  const filtered = Boolean(debounced || status || project)

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Tasks"
        description="Every task across every project, with who owns it and whether it is running late."
      />

      {data && (
        <div data-enter className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-tiny text-muted">
          <span>
            <span className="font-medium tabular text-ink">{data.length}</span> shown
          </span>
          <span>
            <span className="font-medium tabular text-ink">
              {data.filter((t) => t.status !== 'completed').length}
            </span>{' '}
            open
          </span>
          {overdue > 0 && (
            <span className="text-critical">
              <span className="font-medium tabular">{overdue}</span> overdue
            </span>
          )}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search tasks…"
          filters={[
            {
              key: 'status',
              label: 'All statuses',
              value: status,
              onChange: setStatus,
              options: STATUSES.map((value) => ({
                value,
                label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
              })),
            },
            {
              key: 'project',
              label: 'All projects',
              value: project,
              onChange: setProject,
              options: (projects || []).map((p) => ({ value: p.id, label: p.name })),
            },
          ]}
        />
      </div>

      <div data-enter>
        <AdminTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data}
          columns={columns}
          filtered={filtered}
          minWidth="70rem"
          emptyIcon={ListChecks}
          emptyTitle="No tasks yet"
          emptyDescription="Tasks appear here once they are created on a project."
          filteredTitle="No tasks found"
          errorTitle="Unable to load tasks"
        />
      </div>

      {editing && (
        <TaskFormModal
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
          task={editing}
          project={(projects || []).find((p) => p.id === editing.project_id)
            || { id: editing.project_id, name: editing.project_name }}
          phases={[...new Set((data || [])
            .filter((t) => t.project_id === editing.project_id)
            .map((t) => t.phase)
            .filter(Boolean))]}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete "${confirm.title}"?` : ''}
        description="This removes the task and recalculates the project's progress. It cannot be undone."
        confirmLabel="Delete task"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
