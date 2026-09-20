import { useMemo, useState } from 'react'
import { IndianRupee, Plus, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatPercent, titleise } from '@/lib/format'
import { CategoryChart } from '@/charts/CategoryChart'
import { SpendChart } from '@/charts/SpendChart'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/Form'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const CATEGORIES = ['materials', 'labour', 'equipment', 'subcontractor', 'permits', 'overheads']

export function ExpensesTab({ project }) {
  const { can } = useAuth()
  const toast = useToast()
  const { data: analytics, error: analyticsError, loading: loadingAnalytics, reload: reloadAnalytics } =
    useAsync(() => api.expenses.analytics(project.id), [project.id])
  const { data: expenses, error, loading, reload } = useAsync(
    () => api.expenses.list({ project_id: project.id }),
    [project.id],
  )

  const [category, setCategory] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [removing, setRemoving] = useState(false)

  const budget = project.metrics?.budget
  const filtered = useMemo(
    () => (category ? (expenses || []).filter((expense) => expense.category === category) : expenses || []),
    [expenses, category],
  )

  const reloadAll = () => {
    reload()
    reloadAnalytics()
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await api.expenses.remove(deleting.id)
      toast.success('Expense deleted', deleting.title)
      setDeleting(null)
      reloadAll()
    } catch (err) {
      toast.error('Could not delete that expense', err.message)
    } finally {
      setRemoving(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'title',
        header: 'Expense',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate text-base text-ink">{row.title}</p>
            <p className="truncate text-micro text-subtle">
              {row.vendor || 'No vendor'}{row.invoice_ref ? ` · ${row.invoice_ref}` : ''}
            </p>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        width: '140px',
        render: (row) => <span className="text-base text-muted">{titleise(row.category)}</span>,
      },
      {
        key: 'date',
        header: 'Date',
        width: '120px',
        sortValue: (row) => new Date(row.date).getTime(),
        render: (row) => <span className="text-base text-muted">{formatDate(row.date)}</span>,
      },
      {
        key: 'planned_amount',
        header: 'Planned',
        align: 'right',
        width: '120px',
        render: (row) => <span className="text-muted">{formatINR(row.planned_amount)}</span>,
      },
      {
        key: 'amount',
        header: 'Actual',
        align: 'right',
        width: '130px',
        render: (row) => {
          const over = row.planned_amount && row.amount > row.planned_amount
          return (
            <div>
              <p className="text-ink">{formatINR(row.amount)}</p>
              {over && (
                <p className="text-micro text-critical">
                  +{formatPercent(((row.amount - row.planned_amount) / row.planned_amount) * 100)}
                </p>
              )}
            </div>
          )
        },
      },
      ...(can('manageExpenses')
        ? [
            {
              key: 'actions',
              header: '',
              width: '48px',
              sortable: false,
              render: (row) => (
                <button
                  type="button"
                  onClick={() => setDeleting(row)}
                  className="rounded p-1.5 text-subtle transition-colors hover:bg-critical-wash hover:text-critical"
                  aria-label={`Delete ${row.title}`}
                >
                  <Trash2 size={13} />
                </button>
              ),
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [can],
  )

  if (error && analyticsError) {
    return <ErrorState title="We could not load the budget" description={error.message} onRetry={reloadAll} />
  }

  return (
    <div className="space-y-4">
      {/* The three numbers a client asks for first. */}
      <Panel className="p-5">
        <div className="grid gap-5 sm:grid-cols-3">
          <Figure label="Approved budget" value={formatINR(project.budget)} caption={project.client} />
          <Figure
            label="Committed"
            value={formatINR(budget?.spent)}
            caption={`${formatPercent(budget?.burn_percent, 1)} of budget`}
          />
          <Figure
            label="Remaining"
            value={formatINR(budget?.remaining)}
            tone={(budget?.remaining ?? 0) < 0 ? 'critical' : undefined}
            caption={
              budget?.cost_performance_index
                ? `Cost performance index ${budget.cost_performance_index} · forecast ${formatINR(budget.forecast_total)} at completion`
                : undefined
            }
          />
        </div>
        <ProgressBar
          value={budget?.burn_percent ?? 0}
          planned={project.metrics?.schedule?.actual_progress}
          tone={(budget?.overrun_percent ?? 0) > 15 ? 'critical' : (budget?.overrun_percent ?? 0) > 7 ? 'warning' : 'healthy'}
          height="h-2"
          className="mt-5"
        />
        <p className="mt-2 text-tiny text-muted">
          The marker shows completion. Spend sitting to the right of it means money is going out faster than
          the build is coming in.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        {loadingAnalytics ? <ChartSkeleton /> : <SpendChart data={analytics?.monthly || []} title="Spend by month" />}
        {loadingAnalytics ? <ChartSkeleton /> : <CategoryChart data={analytics?.by_category || []} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>{titleise(value)}</option>
          ))}
        </Select>
        <p className="text-tiny text-muted">
          <span className="tabular text-ink">{filtered.length}</span> entries ·{' '}
          <span className="tabular text-ink">{formatINR(filtered.reduce((sum, row) => sum + row.amount, 0))}</span>
        </p>
        {can('manageExpenses') && (
          <Button variant="primary" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus size={15} />
            Record expense
          </Button>
        )}
      </div>

      {loading && !expenses ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <Panel className="overflow-hidden">
          <DataTable
            columns={columns}
            rows={filtered}
            initialSort={{ key: 'date', direction: 'desc' }}
            empty={
              <EmptyState
                icon={IndianRupee}
                title={category ? 'Nothing in that category' : 'No expenses recorded'}
                description={
                  category
                    ? 'Choose a different category to see what has been spent.'
                    : 'Record what the project has spent so budget health can be tracked against progress.'
                }
                action={
                  can('manageExpenses') && !category ? (
                    <Button variant="primary" onClick={() => setCreating(true)}>
                      <Plus size={15} />
                      Record the first expense
                    </Button>
                  ) : null
                }
              />
            }
          />
        </Panel>
      )}

      <ExpenseFormModal
        open={creating}
        project={project}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); reloadAll() }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        loading={removing}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this expense?"
        confirmLabel="Delete expense"
        description={`"${deleting?.title}" for ${formatINR(deleting?.amount)} will be removed and the budget figures recalculated.`}
      />
    </div>
  )
}

function Figure({ label, value, caption, tone }) {
  return (
    <div>
      <p className="text-tiny text-muted">{label}</p>
      <p className={cn('mt-1.5 font-display text-metric tabular', tone === 'critical' ? 'text-critical' : 'text-ink')}>
        {value}
      </p>
      {caption && <p className="mt-1.5 text-micro leading-relaxed text-subtle">{caption}</p>}
    </div>
  )
}

function ExpenseFormModal({ open, onClose, onSaved, project }) {
  const toast = useToast()
  const [form, setForm] = useState({
    title: '', category: 'materials', amount: '', planned_amount: '',
    vendor: '', date: new Date().toISOString().slice(0, 10), invoice_ref: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.expenses.create({
        ...form,
        project_id: project.id,
        amount: Number(form.amount),
        planned_amount: Number(form.planned_amount || form.amount),
      })
      toast.success('Expense recorded', `${form.title} — ${formatINR(Number(form.amount))}`)
      setForm({
        title: '', category: 'materials', amount: '', planned_amount: '',
        vendor: '', date: new Date().toISOString().slice(0, 10), invoice_ref: '', notes: '',
      })
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record expense"
      description={`Charged to ${project?.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>Record expense</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="What was this for" required>
          <Input value={form.title} onChange={set('title')} placeholder="TMT steel supply — September despatch" required minLength={2} />
        </Field>

        <FieldRow>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{titleise(value)}</option>)}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={set('date')} required />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Amount (₹)" required>
            <Input type="number" min="0" step="1" value={form.amount} onChange={set('amount')} placeholder="2203862" required />
          </Field>
          <Field label="Planned amount (₹)" hint="Leave blank to use the actual amount.">
            <Input type="number" min="0" step="1" value={form.planned_amount} onChange={set('planned_amount')} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Vendor">
            <Input value={form.vendor} onChange={set('vendor')} placeholder="Shree Balaji Steels" />
          </Field>
          <Field label="Invoice reference">
            <Input value={form.invoice_ref} onChange={set('invoice_ref')} placeholder="INV-1024" />
          </Field>
        </FieldRow>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} />
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
