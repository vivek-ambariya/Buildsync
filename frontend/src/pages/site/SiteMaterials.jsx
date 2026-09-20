import { useMemo, useState } from 'react'
import { Package, PackagePlus, Truck } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { formatDate, formatNumber } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { MaterialRequestSheet, MaterialUsageSheet } from '@/features/site-ops/MaterialSheets'
import { FilterStrip, SitePageHeader } from '@/features/site-ops/SitePageHeader'

/**
 * Stock as it stands on site.
 *
 * Required, available, used — and nothing about what any of it cost. A site
 * manager's two questions are "have I got enough to work tomorrow" and "who
 * do I tell if I haven't", so every row carries both answers as buttons
 * rather than making them navigate somewhere to act.
 */
export default function SiteMaterials() {
  const { projectId, project } = useSite()
  const { can } = useAuth()
  const [filter, setFilter] = useState('all')
  const [usage, setUsage] = useState(null)
  const [request, setRequest] = useState(null)
  const [showRequests, setShowRequests] = useState(false)

  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.materials(projectId) : Promise.resolve([])),
    [projectId],
  )
  const { data: requests, reload: reloadRequests } = useAsync(
    () => (projectId ? api.site.materialRequests(projectId) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  const materials = data || []
  const counts = useMemo(
    () => ({
      all: materials.length,
      low: materials.filter((m) => m.status !== 'healthy').length,
      healthy: materials.filter((m) => m.status === 'healthy').length,
    }),
    [materials],
  )
  const visible = useMemo(() => {
    if (filter === 'low') return materials.filter((m) => m.status !== 'healthy')
    if (filter === 'healthy') return materials.filter((m) => m.status === 'healthy')
    return materials
  }, [materials, filter])

  const pending = (requests || []).filter((r) => r.status === 'pending')

  if (error) {
    return <ErrorState title="We could not load site stock" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Materials"
        count={counts.low}
        countLabel={counts.low === 1 ? 'needs attention' : 'need attention'}
        action={
          can('requestMaterials') && (
            <Button variant="accent" onClick={() => setRequest({})}>
              <PackagePlus size={15} />
              Request
            </Button>
          )
        }
      >
        <FilterStrip
          className="mt-3.5"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'low', label: 'Running low', count: counts.low },
            { value: 'healthy', label: 'Healthy', count: counts.healthy },
          ]}
        />
      </SitePageHeader>

      {/* Requests already in flight, so nobody raises the same one twice. */}
      {pending.length > 0 && (
        <section className="mb-4" data-enter>
          <button
            type="button"
            onClick={() => setShowRequests((value) => !value)}
            className="tap flex w-full items-center gap-2.5 rounded-panel border border-amber/40 bg-amber-wash px-4 text-left"
          >
            <Truck size={17} className="shrink-0 text-amber-deep" />
            <span className="flex-1 text-base font-medium text-amber-deep">
              {pending.length} request{pending.length === 1 ? '' : 's'} awaiting the project manager
            </span>
            <span className="text-tiny text-amber-deep">{showRequests ? 'Hide' : 'Show'}</span>
          </button>
          {showRequests && (
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
              {pending.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-base font-medium text-ink">
                      {item.material_name}
                      <span className="ml-1.5 text-tiny font-normal tabular text-muted">
                        {formatNumber(item.required_qty, 1)} {item.unit}
                      </span>
                    </p>
                    <StatusBadge status={item.urgency} size="sm" className="shrink-0" />
                  </div>
                  <p className="mt-0.5 text-tiny leading-snug text-muted">{item.reason}</p>
                  <p className="mt-1 text-micro text-subtle">
                    Raised {formatDate(item.created_at, { withYear: false })}
                    {item.needed_by && ` · needed by ${formatDate(item.needed_by, { withYear: false })}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {loading && !data ? (
        <div className="space-y-3" data-enter>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-2 w-full" />
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={Package}
            title={filter === 'low' ? 'Nothing running low' : 'No materials tracked'}
            description={
              filter === 'low'
                ? 'Every material on this site has enough cover for its lead time.'
                : 'Materials appear here once the project manager sets them up for this site.'
            }
          />
        </div>
      ) : (
        <ul className="space-y-3" data-enter>
          {visible.map((material) => (
            <MaterialRow
              key={material.id}
              material={material}
              canRecord={can('manageMaterials')}
              canRequest={can('requestMaterials')}
              onRecord={() => setUsage(material)}
              onRequest={() => setRequest(material)}
            />
          ))}
        </ul>
      )}

      <MaterialUsageSheet
        open={Boolean(usage)}
        material={usage}
        onClose={() => setUsage(null)}
        onSaved={reload}
      />
      <MaterialRequestSheet
        open={Boolean(request)}
        material={request?.id ? request : undefined}
        onClose={() => setRequest(null)}
        onSaved={() => {
          reload()
          reloadRequests()
        }}
      />
    </div>
  )
}

function MaterialRow({ material, canRecord, canRequest, onRecord, onRequest }) {
  const required = Number(material.required_qty) || 0
  const used = Number(material.used_qty) || 0
  const available = Number(material.available_qty) || 0
  const cover = material.metrics?.days_of_cover
  const short = material.status !== 'healthy'

  return (
    <li
      className={cn(
        'rounded-panel border bg-surface p-4',
        material.status === 'critical'
          ? 'rule-left border-critical/30 text-critical'
          : material.status === 'low_stock'
            ? 'rule-left border-amber/40 text-amber'
            : 'border-line',
      )}
    >
      <div className={cn(short && 'pl-2.5')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-[1.0625rem] font-semibold leading-tight text-ink">{material.name}</h3>
            <p className="mt-0.5 truncate text-tiny text-subtle">{material.category}</p>
          </div>
          <StatusBadge status={material.status} size="sm" className="shrink-0" />
        </div>

        <dl className="mt-3.5 grid grid-cols-3 gap-3">
          <Figure label="Required" value={formatNumber(required, 0)} unit={material.unit} />
          <Figure
            label="Available"
            value={formatNumber(available, 0)}
            unit={material.unit}
            tone={short ? 'text-critical' : 'text-ink'}
          />
          <Figure label="Used" value={formatNumber(used, 0)} unit={material.unit} />
        </dl>

        <ProgressBar
          value={required > 0 ? Math.min(100, (used / required) * 100) : 0}
          tone={material.status === 'critical' ? 'critical' : material.status === 'low_stock' ? 'warning' : 'ink'}
          showPlannedMarker={false}
          className="mt-3"
        />
        <p className="mt-1.5 text-micro tabular text-subtle">
          {cover >= 999
            ? 'No consumption recorded yet'
            : `About ${Math.round(cover)} day${Math.round(cover) === 1 ? '' : 's'} of cover at the current rate`}
          {material.metrics?.reorder_by && short && ` · reorder by ${formatDate(material.metrics.reorder_by, { withYear: false })}`}
        </p>

        <div className="mt-3.5 flex gap-2">
          {canRecord && (
            <Button variant="secondary" className="flex-1" onClick={onRecord}>
              Record usage
            </Button>
          )}
          {canRequest && (
            <Button variant={short ? 'accent' : 'secondary'} className="flex-1" onClick={onRequest}>
              Request more
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function Figure({ label, value, unit, tone }) {
  return (
    <div>
      <dt className="text-micro font-medium uppercase tracking-[0.05em] text-subtle">{label}</dt>
      <dd className={cn('mt-1 font-display text-[1.0625rem] font-semibold tabular', tone || 'text-ink')}>
        {value}
        <span className="ml-1 text-micro font-normal text-subtle">{unit}</span>
      </dd>
    </div>
  )
}
