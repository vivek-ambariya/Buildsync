import { useMemo, useState } from 'react'
import { AlertTriangle, Hammer, Pencil, Trash2 } from 'lucide-react'

import { projectService, siteUpdateService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { ConfirmDialog } from '@/components/ui/Modal'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RowMenu } from '@/features/admin/RowMenu'
import { SiteUpdateEditModal } from '@/features/admin/SiteUpdateEditModal'

export default function AdminSiteUpdates() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const [project, setProject] = useState('')
  const [only, setOnly] = useState('')

  const { data, error, loading, reload } = useAsync(
    () => siteUpdateService.list({ project_id: project || undefined, limit: 300 }),
    [project],
  )
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    let list = data || []
    if (debounced) {
      const needle = debounced.toLowerCase()
      list = list.filter(
        (row) =>
          row.work_completed?.toLowerCase().includes(needle) ||
          row.issues?.toLowerCase().includes(needle) ||
          row.reported_by_name?.toLowerCase().includes(needle) ||
          row.project_name?.toLowerCase().includes(needle),
      )
    }
    if (only === 'issues') list = list.filter((row) => row.issues?.trim())
    if (only === 'edited') list = list.filter((row) => row.edited_at)
    return list
  }, [data, debounced, only])

  const remove = async (update) => {
    setBusy(true)
    try {
      await siteUpdateService.remove(update.id)
      toast.success('Site report deleted.')
      setConfirm(null)
      reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot delete site reports.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'date',
        header: 'Date',
        sortValue: (row) => row.date || '',
        render: (row) => (
          <div className="min-w-0">
            <span className="block whitespace-nowrap font-medium text-ink">{formatDate(row.date)}</span>
            <span className="block truncate text-tiny text-subtle">{row.project_name}</span>
          </div>
        ),
      },
      {
        key: 'work_completed',
        header: 'Work completed',
        value: (row) => row.work_completed,
        render: (row) => (
          <div className="min-w-0 max-w-[26rem]">
            <p className="truncate text-ink">{row.work_completed}</p>
            {row.issues?.trim() && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-tiny text-amber-deep">
                <AlertTriangle size={11} className="shrink-0" />
                {row.issues}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'reported_by_name',
        header: 'Filed by',
        value: (row) => row.reported_by_name,
        render: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.reported_by_name} size="sm" />
            <div className="min-w-0">
              <span className="block truncate text-muted">{row.reported_by_name || '—'}</span>
              {row.edited_at && (
                <span className="block truncate text-micro text-subtle">
                  corrected by {row.edited_by_name}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'progress_percent',
        header: 'Progress',
        align: 'right',
        sortValue: (row) => row.progress_percent || 0,
        render: (row) => <span className="tabular text-ink">{row.progress_percent}%</span>,
      },
      {
        key: 'workers_count',
        header: 'Workers',
        align: 'right',
        sortValue: (row) => row.workers_count || 0,
        render: (row) => (
          <span className={cn('tabular', row.workers_count ? 'text-muted' : 'text-line-strong')}>
            {row.workers_count || 0}
          </span>
        ),
      },
      {
        key: 'weather',
        header: 'Weather',
        value: (row) => row.weather,
        render: (row) => <span className="whitespace-nowrap text-tiny text-subtle">{row.weather || '—'}</span>,
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        width: '3rem',
        align: 'right',
        render: (row) => (
          <RowMenu
            label={`Actions for the report of ${formatDate(row.date)}`}
            items={[
              { label: 'Correct report', icon: Pencil, onSelect: () => setEditing(row) },
              { label: 'Delete report', icon: Trash2, destructive: true, onSelect: () => setConfirm(row) },
            ]}
          />
        ),
      },
    ],
    [],
  )

  const withIssues = (data || []).filter((row) => row.issues?.trim()).length

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Site updates"
        description="Every daily report filed from site, including the issues raised and any corrections made since."
      />

      {data && (
        <div data-enter className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-tiny text-muted">
          <span>
            <span className="font-medium tabular text-ink">{data.length}</span> reports
          </span>
          {withIssues > 0 && (
            <span className="text-amber-deep">
              <span className="font-medium tabular">{withIssues}</span> with issues raised
            </span>
          )}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search reports, issues or authors…"
          filters={[
            {
              key: 'project',
              label: 'All projects',
              value: project,
              onChange: setProject,
              options: (projects || []).map((p) => ({ value: p.id, label: p.name })),
            },
            {
              key: 'only',
              label: 'All reports',
              value: only,
              onChange: setOnly,
              options: [
                { value: 'issues', label: 'With issues' },
                { value: 'edited', label: 'Corrected' },
              ],
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
          filtered={Boolean(debounced || project || only)}
          minWidth="76rem"
          emptyIcon={Hammer}
          emptyTitle="No site reports yet"
          emptyDescription="Daily reports appear here as they are filed from site."
          filteredTitle="No reports found"
          errorTitle="Unable to load site reports"
        />
      </div>

      <SiteUpdateEditModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSaved={reload}
        update={editing}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete the report of ${formatDate(confirm.date)}?` : ''}
        description="This removes the site's account of that day, including the headcount and issues it recorded. It cannot be undone."
        confirmLabel="Delete report"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
