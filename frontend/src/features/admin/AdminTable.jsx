import { Search, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { DataTable } from '@/components/ui/DataTable'
import { Input, Select } from '@/components/ui/Form'
import { Panel } from '@/components/ui/Panel'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

/**
 * The filter bar above every admin table.
 *
 * Filters stay visible while results change so it is always clear *why* a
 * table is showing what it is showing — an empty table with a hidden filter
 * reads as missing data.
 */
export function AdminToolbar({
  query,
  onQuery,
  placeholder = 'Search…',
  filters = [],
  actions,
  className,
}) {
  const active = filters.filter((filter) => filter.value)
  const hasFilters = Boolean(query) || active.length > 0

  return (
    <div className={cn('mb-4 flex flex-col gap-3 lg:flex-row lg:items-center', className)}>
      <div className="relative min-w-0 flex-1 lg:max-w-xs">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
        />
        <Input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={placeholder}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            aria-label={filter.label}
            className="h-9 w-auto min-w-[9rem] text-tiny"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              onQuery('')
              filters.forEach((filter) => filter.onChange(''))
            }}
            className="inline-flex items-center gap-1 rounded-control px-2 py-1.5 text-tiny text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
  )
}

/**
 * A table with its three other states attached.
 *
 * Every admin list needs the same four outcomes — loading, failed, nothing,
 * something — so they are defined once here. `filtered` distinguishes "no
 * records exist" from "your filters excluded them all", because those need
 * different next steps.
 */
export function AdminTable({
  loading,
  error,
  onRetry,
  rows,
  columns,
  emptyIcon,
  emptyTitle = 'Nothing to show',
  emptyDescription,
  filteredTitle = 'No matches',
  filteredDescription = 'Try changing your filters or clearing the search.',
  filtered = false,
  errorTitle = 'Unable to load this',
  action,
  minWidth,
  onRowClick,
  rowKey,
  initialSort,
  skeletonColumns,
}) {
  if (loading && !rows) {
    return <TableSkeleton rows={7} columns={skeletonColumns || Math.min(columns.length, 6)} />
  }

  if (error) {
    return (
      <Panel>
        <ErrorState compact title={errorTitle} description={error.message} onRetry={onRetry} />
      </Panel>
    )
  }

  const list = rows || []
  if (!list.length) {
    return (
      <Panel>
        <EmptyState
          compact
          icon={emptyIcon}
          title={filtered ? filteredTitle : emptyTitle}
          description={filtered ? filteredDescription : emptyDescription}
          action={filtered ? undefined : action}
        />
      </Panel>
    )
  }

  return (
    <Panel className="overflow-hidden">
      <DataTable
        columns={columns}
        rows={list}
        rowKey={rowKey}
        onRowClick={onRowClick}
        initialSort={initialSort}
        minWidth={minWidth}
      />
    </Panel>
  )
}
