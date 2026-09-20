import { useMemo, useState } from 'react'
import { Boxes, Trash2 } from 'lucide-react'

import { materialService, projectService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatINR, formatNumber } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RowMenu } from '@/features/admin/RowMenu'

export default function AdminMaterials() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const [project, setProject] = useState('')
  const [stock, setStock] = useState('')

  const { data, error, loading, reload } = useAsync(
    () => materialService.list({ project_id: project || undefined }),
    [project],
  )
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  // Name, supplier and stock health are filtered here: the API takes a project
  // filter, and narrowing the rest client-side avoids a request per keystroke.
  const rows = useMemo(() => {
    let list = data || []
    if (debounced) {
      const needle = debounced.toLowerCase()
      list = list.filter(
        (row) =>
          row.name?.toLowerCase().includes(needle) ||
          row.supplier?.toLowerCase().includes(needle) ||
          row.category?.toLowerCase().includes(needle),
      )
    }
    if (stock) list = list.filter((row) => row.status === stock)
    return list
  }, [data, debounced, stock])

  const remove = async (material) => {
    setBusy(true)
    try {
      await materialService.remove(material.id)
      toast.success(`${material.name} removed.`)
      setConfirm(null)
      reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot delete materials.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Material',
        value: (row) => row.name,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.name}</span>
            <span className="block truncate text-tiny text-subtle">
              {row.category} · {row.project_name}
            </span>
          </div>
        ),
      },
      {
        key: 'supplier',
        header: 'Supplier',
        value: (row) => row.supplier,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate text-muted">{row.supplier || 'Unlisted'}</span>
            <span className="block text-micro text-subtle">{row.lead_time_days}d lead time</span>
          </div>
        ),
      },
      {
        key: 'available_qty',
        header: 'In stock',
        align: 'right',
        sortValue: (row) => row.available_qty || 0,
        render: (row) => (
          <div>
            <span className="block text-ink">
              {formatNumber(row.available_qty)} {row.unit}
            </span>
            <span className="block text-micro text-subtle">
              of {formatNumber(row.required_qty)} needed
            </span>
          </div>
        ),
      },
      {
        key: 'cover',
        header: 'Days of cover',
        align: 'right',
        sortValue: (row) => row.metrics?.days_of_cover ?? 999,
        render: (row) => {
          const cover = row.metrics?.days_of_cover
          if (cover === undefined || cover === null) return <span className="text-subtle">—</span>
          return (
            <span
              className={cn(
                'tabular',
                row.status === 'critical'
                  ? 'font-medium text-critical'
                  : row.status === 'low_stock'
                    ? 'text-amber-deep'
                    : 'text-muted',
              )}
            >
              {cover >= 999 ? '—' : `${Math.round(cover)}d`}
            </span>
          )
        },
      },
      {
        key: 'status',
        header: 'Stock',
        value: (row) => row.status,
        render: (row) => <StatusBadge status={row.status} size="sm" />,
      },
      {
        key: 'reorder_by',
        header: 'Reorder by',
        align: 'right',
        sortValue: (row) => row.metrics?.reorder_by || '',
        render: (row) => (
          <span className="whitespace-nowrap text-tiny text-muted">
            {row.metrics?.reorder_by ? formatDate(row.metrics.reorder_by) : '—'}
          </span>
        ),
      },
      {
        key: 'value',
        header: 'Value',
        align: 'right',
        sortValue: (row) => (row.available_qty || 0) * (row.unit_cost || 0),
        render: (row) => (
          <span className="text-muted">
            {formatINR((row.available_qty || 0) * (row.unit_cost || 0))}
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
            label={`Actions for ${row.name}`}
            items={[
              { label: 'Delete material', icon: Trash2, destructive: true, onSelect: () => setConfirm(row) },
            ]}
          />
        ),
      },
    ],
    [],
  )

  const critical = (data || []).filter((row) => row.status === 'critical').length
  const low = (data || []).filter((row) => row.status === 'low_stock').length

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Materials"
        description="Stock across every site, with how long each line will last at its current burn rate."
      />

      {data && (
        <div data-enter className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-tiny text-muted">
          <span>
            <span className="font-medium tabular text-ink">{data.length}</span> lines
          </span>
          {critical > 0 && (
            <span className="text-critical">
              <span className="font-medium tabular">{critical}</span> critical
            </span>
          )}
          {low > 0 && (
            <span className="text-amber-deep">
              <span className="font-medium tabular">{low}</span> low stock
            </span>
          )}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by material, supplier or category…"
          filters={[
            {
              key: 'project',
              label: 'All projects',
              value: project,
              onChange: setProject,
              options: (projects || []).map((p) => ({ value: p.id, label: p.name })),
            },
            {
              key: 'stock',
              label: 'All stock levels',
              value: stock,
              onChange: setStock,
              options: [
                { value: 'critical', label: 'Critical' },
                { value: 'low_stock', label: 'Low stock' },
                { value: 'healthy', label: 'Healthy' },
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
          filtered={Boolean(debounced || project || stock)}
          minWidth="76rem"
          emptyIcon={Boxes}
          emptyTitle="No materials yet"
          emptyDescription="Material registers appear here once they are added to a project."
          filteredTitle="No materials found"
          errorTitle="Unable to load materials"
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete ${confirm.name}?` : ''}
        description="This removes the material and its stock history from the project. It cannot be undone."
        confirmLabel="Delete material"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
