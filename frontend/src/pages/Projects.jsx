import { useMemo, useState } from 'react'
import { Building2, LayoutGrid, Plus, Rows3, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { daysUntil, formatDate, formatINR, formatPercent, titleise } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { ProjectCard } from '@/components/ProjectCard'
import { ProjectFormModal } from '@/features/projects/ProjectFormModal'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { Input, Select } from '@/components/ui/Form'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton, TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const STATUSES = ['planning', 'active', 'at_risk', 'delayed', 'on_hold', 'completed']
const SORTS = [
  { value: 'risk', label: 'Most at risk' },
  { value: 'progress', label: 'Progress' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'budget', label: 'Budget' },
  { value: 'name', label: 'Name' },
]

export default function Projects() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsync(() => api.projects.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState('risk')
  const [view, setView] = useState('grid')
  const [creating, setCreating] = useState(false)

  const categories = useMemo(
    () => [...new Set((data || []).map((project) => project.category))].sort(),
    [data],
  )

  const filtered = useMemo(() => {
    let rows = data || []
    const term = query.trim().toLowerCase()
    if (term) {
      rows = rows.filter(
        (project) =>
          project.name.toLowerCase().includes(term) ||
          project.code.toLowerCase().includes(term) ||
          (project.location || '').toLowerCase().includes(term) ||
          (project.manager_name || '').toLowerCase().includes(term),
      )
    }
    if (status) rows = rows.filter((project) => project.status === status)
    if (category) rows = rows.filter((project) => project.category === category)

    const variance = (project) => project.metrics?.schedule?.variance ?? 0
    const sorters = {
      risk: (a, b) => variance(a) - variance(b),
      progress: (a, b) => (b.metrics?.schedule?.actual_progress ?? 0) - (a.metrics?.schedule?.actual_progress ?? 0),
      deadline: (a, b) => new Date(a.end_date) - new Date(b.end_date),
      budget: (a, b) => b.budget - a.budget,
      name: (a, b) => a.name.localeCompare(b.name),
    }
    return [...rows].sort(sorters[sort])
  }, [data, query, status, category, sort])

  const activeFilters = Boolean(query || status || category)

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Project',
        value: (row) => row.name,
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.name}</p>
            <p className="truncate text-tiny text-muted">
              {row.code} · {row.location || row.category}
            </p>
          </div>
        ),
      },
      {
        key: 'progress',
        header: 'Progress',
        width: '190px',
        sortValue: (row) => row.metrics?.schedule?.actual_progress ?? 0,
        render: (row) => {
          const schedule = row.metrics?.schedule
          const variance = schedule?.variance ?? 0
          const tone = variance <= -12 ? 'critical' : variance < -4 ? 'warning' : 'healthy'
          return (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base tabular text-ink">{formatPercent(schedule?.actual_progress)}</span>
                <span
                  className={cn(
                    'text-micro tabular',
                    tone === 'critical' ? 'text-critical' : tone === 'warning' ? 'text-amber-deep' : 'text-healthy',
                  )}
                >
                  {variance > 0 ? '+' : ''}{variance.toFixed(1)}
                </span>
              </div>
              <ProgressBar value={schedule?.actual_progress ?? 0} planned={schedule?.planned_progress} tone={tone} className="mt-1.5" />
            </div>
          )
        },
      },
      { key: 'manager_name', header: 'Manager', width: '140px' },
      {
        key: 'budget',
        header: 'Budget',
        align: 'right',
        width: '150px',
        render: (row) => (
          <div>
            <p className="text-ink">{formatINR(row.budget)}</p>
            <p className="text-micro text-subtle">
              {formatPercent(row.metrics?.budget?.burn_percent)} committed
            </p>
          </div>
        ),
      },
      {
        key: 'end_date',
        header: 'Deadline',
        align: 'right',
        width: '130px',
        sortValue: (row) => new Date(row.end_date).getTime(),
        render: (row) => {
          const remaining = daysUntil(row.end_date)
          return (
            <div>
              <p className="text-ink">{formatDate(row.end_date)}</p>
              <p className={cn('text-micro', remaining < 45 ? 'text-critical' : 'text-subtle')}>
                {remaining < 0 ? `${Math.abs(remaining)} days over` : `${remaining} days left`}
              </p>
            </div>
          )
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: '110px',
        render: (row) => <StatusBadge status={row.status} size="sm" pulse={row.status === 'at_risk'} />,
      },
    ],
    [],
  )

  if (error) {
    return <ErrorState title="We could not load your projects" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <PageHeader
        title="Projects"
        description="Every construction project in the portfolio, ranked by how far each one has drifted from plan."
        actions={
          can('manageProjects') && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={15} />
              New project
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center" data-enter>
        <div className="relative flex-1 lg:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, code, city or manager"
            className="pl-9"
            aria-label="Search projects"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto" aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>{titleise(value)}</option>
            ))}
          </Select>

          <Select value={category} onChange={(event) => setCategory(event.target.value)} className="w-auto" aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </Select>

          <Select value={sort} onChange={(event) => setSort(event.target.value)} className="w-auto" aria-label="Sort projects">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>

          {activeFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setStatus(''); setCategory('') }}>
              <X size={13} />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5 lg:ml-auto">
          {[
            { value: 'grid', icon: LayoutGrid, label: 'Card view' },
            { value: 'table', icon: Rows3, label: 'Table view' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setView(option.value)}
              aria-label={option.label}
              aria-pressed={view === option.value}
              className={cn(
                'rounded-[5px] p-1.5 transition-colors duration-150',
                view === option.value ? 'bg-raised text-ink' : 'text-subtle hover:text-ink',
              )}
            >
              <option.icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        view === 'grid' ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Panel key={index} className="p-5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="mt-2 h-5 w-40" />
                <Skeleton className="mt-5 h-7 w-24" />
                <Skeleton className="mt-3 h-1.5 w-full" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((__, cell) => (
                    <Skeleton key={cell} className="h-8" />
                  ))}
                </div>
              </Panel>
            ))}
          </div>
        ) : (
          <TableSkeleton rows={8} columns={6} />
        )
      ) : filtered.length === 0 ? (
        <Panel data-enter>
          {activeFilters ? (
            <EmptyState
              icon={Search}
              title="No projects match those filters"
              description="Try a different status or clear the search to see the whole portfolio."
              action={
                <Button variant="secondary" onClick={() => { setQuery(''); setStatus(''); setCategory('') }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Building2}
              title="No projects yet"
              description="Create your first construction project to start tracking progress, spend and materials."
              action={
                can('manageProjects') && (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus size={15} />
                    Create project
                  </Button>
                )
              }
            />
          )}
        </Panel>
      ) : view === 'grid' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project, index) => (
            <div key={project.id} data-enter>
              <ProjectCard project={project} delay={index * 0.04} />
            </div>
          ))}
        </div>
      ) : (
        <Panel className="overflow-hidden" data-enter>
          <DataTable
            columns={columns}
            rows={filtered}
            onRowClick={(row) => navigate(`/app/projects/${row.id}`)}
          />
        </Panel>
      )}

      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false)
          reload()
        }}
      />
    </div>
  )
}
