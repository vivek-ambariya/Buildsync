import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/cn'
import { EmptyState } from './States'

/**
 * A sortable table.
 *
 * Columns declare `align: 'right'` for figures, which also switches them to
 * tabular numerals so the digits line up down the column.
 */
export function DataTable({
  columns,
  rows,
  rowKey = (row, index) => row.id ?? index,
  onRowClick,
  empty,
  initialSort,
  className,
  dense = false,
  minWidth = '42rem',
}) {
  const [sort, setSort] = useState(initialSort || null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column) return rows
    const accessor = column.sortValue || column.value || ((row) => row[column.key])
    return [...rows].sort((a, b) => {
      const left = accessor(a)
      const right = accessor(b)
      if (left === right) return 0
      if (left === null || left === undefined) return 1
      if (right === null || right === undefined) return -1
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right))
      return sort.direction === 'asc' ? result : -result
    })
  }, [rows, sort, columns])

  const toggleSort = (column) => {
    if (column.sortable === false) return
    setSort((current) =>
      current?.key === column.key
        ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: 'asc' },
    )
  }

  if (!rows.length) {
    return empty || <EmptyState compact title="Nothing here yet" description="Rows will appear once there is data." />
  }

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-base" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line bg-raised/60">
            {columns.map((column) => {
              const active = sort?.key === column.key
              const Icon = !active ? ChevronsUpDown : sort.direction === 'asc' ? ArrowUp : ArrowDown
              return (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'px-4 py-2.5 text-tiny font-medium text-muted',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.sortable !== false && 'cursor-pointer select-none hover:text-ink',
                  )}
                  onClick={() => toggleSort(column)}
                >
                  <span className={cn('inline-flex items-center gap-1', column.align === 'right' && 'flex-row-reverse')}>
                    {column.header}
                    {column.sortable !== false && (
                      <Icon size={11} className={cn('transition-opacity', active ? 'opacity-90' : 'opacity-35')} />
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                'transition-colors duration-150',
                onRowClick && 'cursor-pointer hover:bg-raised',
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'px-4 align-middle',
                    dense ? 'py-2.5' : 'py-3.5',
                    column.align === 'right' && 'text-right tabular',
                    column.className,
                  )}
                >
                  {column.render ? column.render(row) : (column.value ? column.value(row) : row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
