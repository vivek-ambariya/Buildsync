import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity as ActivityIcon, ChevronLeft, ChevronRight } from 'lucide-react'

import { adminService, userService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, relativeTime, titleise } from '@/lib/format'
import { ROLE_NAMES } from '@/lib/permissions'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'

const PERIODS = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
]

/** Actions that change who can do what are worth spotting in a long list. */
const SENSITIVE = new Set([
  'created user', 'deleted user', 'changed user role', 'activated user',
  'deactivated user', 'reset user password', 'changed project assignments',
  'deleted project', 'deleted report', 'deleted document',
])

export default function AdminActivity() {
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 300)
  const [entityType, setEntityType] = useState('')
  const [actorId, setActorId] = useState('')
  const [days, setDays] = useState('')
  const [page, setPage] = useState(1)

  const { data, error, loading, reload } = useAsync(
    () =>
      adminService.activity({
        q: debounced || undefined,
        entity_type: entityType || undefined,
        actor_id: actorId || undefined,
        days: days || undefined,
        page,
        page_size: 40,
      }),
    [debounced, entityType, actorId, days, page],
  )
  const { data: people } = useAsync(() => userService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  // Any filter change puts you back on the first page; staying on page 4 of a
  // newly filtered list shows an empty table for no visible reason.
  const onFilter = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const columns = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'When',
        sortable: false,
        width: '11rem',
        render: (row) => (
          <div className="min-w-0">
            <span className="block whitespace-nowrap text-ink">{relativeTime(row.created_at)}</span>
            <span className="block whitespace-nowrap text-micro text-subtle">
              {formatDate(row.created_at)}
            </span>
          </div>
        ),
      },
      {
        key: 'actor_name',
        header: 'Who',
        sortable: false,
        render: (row) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.actor_name} size="sm" />
            <div className="min-w-0">
              <span className="block truncate text-ink">{row.actor_name || 'System'}</span>
              <span className="block truncate text-micro text-subtle">
                {ROLE_NAMES[row.actor_role] || row.actor_role || '—'}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'action',
        header: 'Action',
        sortable: false,
        render: (row) => (
          <span
            className={cn(
              'whitespace-nowrap rounded-pill border px-2 py-0.5 text-micro font-medium',
              SENSITIVE.has(row.action)
                ? 'border-amber/35 bg-amber-wash text-amber-deep'
                : 'border-line bg-raised text-muted',
            )}
          >
            {titleise(row.action)}
          </span>
        ),
      },
      {
        key: 'entity_type',
        header: 'Entity',
        sortable: false,
        render: (row) => <span className="text-tiny text-muted">{titleise(row.entity_type)}</span>,
      },
      {
        key: 'detail',
        header: 'Detail',
        sortable: false,
        render: (row) => (
          <div className="min-w-0 max-w-[28rem]">
            <p className="truncate text-muted">{row.detail || '—'}</p>
            {row.project_name && (
              <Link
                to={`/app/projects/${row.project_id}`}
                className="truncate text-micro text-subtle transition-colors hover:text-ink"
              >
                {row.project_name}
              </Link>
            )}
          </div>
        ),
      },
    ],
    [],
  )

  const filtered = Boolean(debounced || entityType || actorId || days)
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Activity logs"
        description="Who did what, and when. Every administrative action is recorded here; passwords and tokens never are."
      />

      {data && (
        <div data-enter className="mb-4 text-tiny text-muted">
          <span className="font-medium tabular text-ink">{total.toLocaleString()}</span> entries
          {pages > 1 && (
            <>
              {' '}
              · page <span className="tabular text-ink">{data.page}</span> of{' '}
              <span className="tabular text-ink">{pages}</span>
            </>
          )}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={onFilter(setQuery)}
          placeholder="Search actions, details or people…"
          filters={[
            {
              key: 'actor',
              label: 'Anyone',
              value: actorId,
              onChange: onFilter(setActorId),
              options: (people || []).map((person) => ({ value: person.id, label: person.name })),
            },
            {
              key: 'entity',
              label: 'All entities',
              value: entityType,
              onChange: onFilter(setEntityType),
              options: (data?.entity_types || []).map((value) => ({
                value,
                label: titleise(value),
              })),
            },
            {
              key: 'days',
              label: 'All time',
              value: days,
              onChange: onFilter(setDays),
              options: PERIODS,
            },
          ]}
        />
      </div>

      <div data-enter>
        <AdminTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.entries}
          columns={columns}
          filtered={filtered}
          minWidth="70rem"
          emptyIcon={ActivityIcon}
          emptyTitle="No activity recorded"
          emptyDescription="Entries appear here as people create, change and remove records."
          filteredTitle="No matching activity"
          filteredDescription="Try a wider period, a different person, or clear the search."
          errorTitle="Unable to load the activity log"
        />
      </div>

      {pages > 1 && (
        <div data-enter className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1 || loading}
          >
            <ChevronLeft size={14} />
            Previous
          </Button>
          <span className="text-tiny tabular text-muted">
            {data.page} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            disabled={page >= pages || loading}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  )
}
