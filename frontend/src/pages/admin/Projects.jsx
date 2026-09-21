import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, ExternalLink, Pencil, Plus, Trash2, UserCog } from 'lucide-react'

import { projectService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatPercent } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { AssignManagerModal } from '@/features/admin/AssignManagerModal'
import { RowMenu } from '@/features/admin/RowMenu'

const STATUSES = ['planning', 'active', 'at_risk', 'delayed', 'on_hold', 'completed']

/** How far behind plan a project is, as a word. */
function riskOf(project) {
  const schedule = project.metrics?.schedule
  const budget = project.metrics?.budget
  const variance = schedule?.variance ?? 0
  const overrun = budget?.overrun_percent ?? 0
  if (variance <= -12 || overrun >= 15) return { label: 'High', tone: 'critical' }
  if (variance <= -5 || overrun >= 7) return { label: 'Medium', tone: 'warning' }
  return { label: 'Low', tone: 'healthy' }
}

export default function AdminProjects() {
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const status = params.get('status') || ''
  const manager = params.get('manager') || ''

  const setParam = (key) => (value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }

  const { data, error, loading, reload } = useAsync(
    () => projectService.list({ q: debounced || undefined, status: status || undefined }),
    [debounced, status],
  )
  const scope = useEnter([loading, Boolean(data)])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const managers = useMemo(() => {
    const seen = new Map()
    ;(data || []).forEach((project) => {
      if (project.manager_id && !seen.has(project.manager_id)) {
        seen.set(project.manager_id, project.manager_name)
      }
    })
    return [...seen].map(([value, label]) => ({ value, label }))
  }, [data])

  // The manager filter is applied here because the API filters by status and
  // search only; doing it client-side keeps one request per keystroke instead
  // of two dimensions of server round trips.
  const rows = useMemo(
    () => (manager ? (data || []).filter((project) => project.manager_id === manager) : data),
    [data, manager],
  )

  const remove = async (project) => {
    setBusy(true)
    try {
      await projectService.remove(project.id)
      toast.success(`${project.name} deleted.`)
      setConfirm(null)
      reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Only an administrator can delete a project.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Project',
        value: (row) => row.name,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.name}</span>
            <span className="block truncate text-tiny text-subtle">
              {row.code} · {row.location}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        value: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} size="sm" />,
      },
      {
        key: 'manager_name',
        header: 'Manager',
        value: (row) => row.manager_name,
        render: (row) => (
          <span className={cn('truncate', row.manager_id ? 'text-muted' : 'text-subtle')}>
            {row.manager_name}
          </span>
        ),
      },
      {
        key: 'progress',
        header: 'Progress',
        width: '11rem',
        sortValue: (row) => row.metrics?.schedule?.actual_progress ?? 0,
        render: (row) => {
          const schedule = row.metrics?.schedule
          const actual = schedule?.actual_progress ?? 0
          return (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-tiny tabular text-ink">{formatPercent(actual)}</span>
                <span
                  className={cn(
                    'text-micro tabular',
                    (schedule?.variance ?? 0) < -4 ? 'text-critical' : 'text-subtle',
                  )}
                >
                  {(schedule?.variance ?? 0) > 0 ? '+' : ''}
                  {(schedule?.variance ?? 0).toFixed(1)}
                </span>
              </div>
              <ProgressBar
                value={actual}
                planned={schedule?.planned_progress}
                tone={
                  schedule?.schedule_health === 'critical'
                    ? 'critical'
                    : schedule?.schedule_health === 'warning'
                      ? 'warning'
                      : 'healthy'
                }
                className="mt-1.5"
              />
            </div>
          )
        },
      },
      {
        key: 'risk',
        header: 'Risk',
        sortValue: (row) => ({ High: 0, Medium: 1, Low: 2 })[riskOf(row).label],
        render: (row) => {
          const risk = riskOf(row)
          return (
            <StatusBadge
              status={risk.tone === 'critical' ? 'high' : risk.tone === 'warning' ? 'medium' : 'low'}
              label={risk.label}
              size="sm"
            />
          )
        },
      },
      {
        key: 'budget',
        header: 'Budget',
        align: 'right',
        sortValue: (row) => row.budget || 0,
        render: (row) => (
          <div>
            <span className="block text-ink">{formatINR(row.budget)}</span>
            <span className="block text-micro text-subtle">
              {formatINR(row.metrics?.budget?.spent || 0)} spent
            </span>
          </div>
        ),
      },
      {
        key: 'end_date',
        header: 'Deadline',
        align: 'right',
        sortValue: (row) => row.end_date || '',
        render: (row) => (
          <span className="whitespace-nowrap text-tiny text-muted">{formatDate(row.end_date)}</span>
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
            label={`Actions for ${row.name}`}
            items={[
              { label: 'Open project', icon: ExternalLink, onSelect: () => navigate(`/admin/projects/${row.id}`) },
              { label: 'Edit project', icon: Pencil, onSelect: () => { setEditing(row); setFormOpen(true) } },
              { label: 'Assign manager', icon: UserCog, onSelect: () => setAssigning(row) },
              {
                label: 'Delete project',
                icon: Trash2,
                destructive: true,
                onSelect: () => setConfirm(row),
              },
            ]}
          />
        ),
      },
    ],
    [navigate],
  )

  const filtered = Boolean(debounced || status || manager)

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="All projects"
        description="Every project on the platform, whoever runs it, with schedule and budget health in one view."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus size={14} />
            New project
          </Button>
        }
      />

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name or code…"
          filters={[
            {
              key: 'status',
              label: 'All statuses',
              value: status,
              onChange: setParam('status'),
              options: STATUSES.map((value) => ({
                value,
                label: value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
              })),
            },
            {
              key: 'manager',
              label: 'All managers',
              value: manager,
              onChange: setParam('manager'),
              options: managers,
            },
          ]}
        />
      </div>

      <div data-enter>
        <AdminTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={rows}
          columns={columns}
          filtered={filtered}
          minWidth="74rem"
          emptyIcon={Building2}
          emptyTitle="No projects yet"
          emptyDescription="Create the first project to start tracking progress, spend and risk."
          filteredTitle="No projects found"
          filteredDescription="Try changing your filters or clearing the search."
          errorTitle="Unable to load projects"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus size={14} />
              New project
            </Button>
          }
        />
      </div>

      <ProjectFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        project={editing}
      />
      <AssignManagerModal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        onSaved={reload}
        project={assigning}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete ${confirm.name}?` : ''}
        description={
          confirm
            ? `This permanently removes the project and everything filed against it — tasks, materials, expenses, documents and site reports. ${formatINR(confirm.budget)} of budget history will be lost. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete project"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
