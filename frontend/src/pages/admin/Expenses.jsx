import { useMemo, useState } from 'react'
import { Receipt, Trash2 } from 'lucide-react'

import { expenseService, projectService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatPercent, titleise } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { CategoryChart } from '@/charts/CategoryChart'
import { SpendChart } from '@/charts/SpendChart'
import { MetricCard } from '@/components/MetricCard'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ChartSkeleton, MetricSkeleton } from '@/components/ui/Skeleton'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RowMenu } from '@/features/admin/RowMenu'

const CATEGORIES = ['materials', 'labour', 'equipment', 'subcontractor', 'permits', 'overheads']

export default function AdminExpenses() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const [project, setProject] = useState('')
  const [category, setCategory] = useState('')

  const { data, error, loading, reload } = useAsync(
    () =>
      expenseService.list({
        project_id: project || undefined,
        category: category || undefined,
        limit: 500,
      }),
    [project, category],
  )
  const analytics = useAsync(() => expenseService.analytics(project || undefined), [project])
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => {
    if (!debounced) return data
    const needle = debounced.toLowerCase()
    return (data || []).filter(
      (row) =>
        row.title?.toLowerCase().includes(needle) ||
        row.vendor?.toLowerCase().includes(needle) ||
        row.project_name?.toLowerCase().includes(needle),
    )
  }, [data, debounced])

  const remove = async (expense) => {
    setBusy(true)
    try {
      await expenseService.remove(expense.id)
      toast.success('Expense deleted.')
      setConfirm(null)
      reload()
      analytics.reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot delete expenses.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Expense',
        value: (row) => row.title,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.title}</span>
            <span className="block truncate text-tiny text-subtle">{row.project_name}</span>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        value: (row) => row.category,
        render: (row) => (
          <span className="whitespace-nowrap rounded-pill border border-line bg-raised px-2 py-0.5 text-micro text-muted">
            {titleise(row.category)}
          </span>
        ),
      },
      {
        key: 'vendor',
        header: 'Vendor',
        value: (row) => row.vendor,
        render: (row) => <span className="truncate text-muted">{row.vendor || 'Unlisted'}</span>,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        sortValue: (row) => row.amount || 0,
        render: (row) => {
          const planned = row.planned_amount || 0
          const over = planned > 0 && row.amount > planned
          return (
            <div>
              <span className={cn('block font-medium', over ? 'text-critical' : 'text-ink')}>
                {formatINR(row.amount)}
              </span>
              {planned > 0 && (
                <span className="block text-micro text-subtle">
                  {formatINR(planned)} planned
                </span>
              )}
            </div>
          )
        },
      },
      {
        key: 'date',
        header: 'Date',
        align: 'right',
        sortValue: (row) => row.date || '',
        render: (row) => (
          <span className="whitespace-nowrap text-tiny text-muted">{formatDate(row.date)}</span>
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
              { label: 'Delete expense', icon: Trash2, destructive: true, onSelect: () => setConfirm(row) },
            ]}
          />
        ),
      },
    ],
    [],
  )

  const stats = analytics.data

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Expenses"
        description="Every rupee committed across the platform, and how it splits by category and month."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {analytics.loading && !stats ? (
          Array.from({ length: 3 }).map((_, index) => <MetricSkeleton key={index} />)
        ) : stats ? (
          <>
            <div data-enter>
              <MetricCard
                label="Total spent"
                value={stats.total}
                format={(value) => formatINR(value)}
                caption={project ? 'on this project' : 'across every project'}
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Planned"
                value={stats.planned_total}
                format={(value) => formatINR(value)}
                caption="budgeted for the same lines"
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Against plan"
                value={stats.planned_total ? ((stats.total - stats.planned_total) / stats.planned_total) * 100 : 0}
                format={(value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
                tone={stats.total > stats.planned_total ? 'critical' : 'healthy'}
                rule={stats.total > stats.planned_total ? 'critical' : 'healthy'}
                caption={
                  stats.total > stats.planned_total
                    ? `${formatINR(stats.total - stats.planned_total)} over plan`
                    : `${formatINR(stats.planned_total - stats.total)} under plan`
                }
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div data-enter className="min-w-0">
          {analytics.loading && !stats ? (
            <ChartSkeleton />
          ) : (
            <SpendChart
              data={stats?.monthly || []}
              title="Spend by month"
              description="Committed against planned, across the selected scope"
              height={300}
            />
          )}
        </div>
        <div data-enter className="min-w-0">
          {analytics.loading && !stats ? (
            <ChartSkeleton />
          ) : (
            <CategoryChart data={stats?.by_category || []} height={300} />
          )}
        </div>
      </div>

      <div data-enter className="mt-6">
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by expense, vendor or project…"
          filters={[
            {
              key: 'project',
              label: 'All projects',
              value: project,
              onChange: setProject,
              options: (projects || []).map((p) => ({ value: p.id, label: p.name })),
            },
            {
              key: 'category',
              label: 'All categories',
              value: category,
              onChange: setCategory,
              options: CATEGORIES.map((value) => ({ value, label: titleise(value) })),
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
          filtered={Boolean(debounced || project || category)}
          minWidth="62rem"
          emptyIcon={Receipt}
          emptyTitle="No expenses yet"
          emptyDescription="Spend appears here once it is recorded against a project."
          filteredTitle="No expenses found"
          errorTitle="Unable to load expenses"
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete "${confirm.title}"?` : ''}
        description={
          confirm
            ? `This removes ${formatINR(confirm.amount)} from the project's spend history. It cannot be undone.`
            : ''
        }
        confirmLabel="Delete expense"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
