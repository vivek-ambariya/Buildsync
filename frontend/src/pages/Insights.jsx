import { useMemo, useState } from 'react'
import { Package, RefreshCw, Sparkles, TrendingDown, Wallet } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { AIInsightCard } from '@/components/AIInsightCard'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Select } from '@/components/ui/Form'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

/** The three risks a construction business actually loses money to. */
const GROUPS = [
  {
    key: 'schedule',
    label: 'Schedule risk',
    icon: TrendingDown,
    blurb: 'Progress measured against the contract programme, and where the current rate of build lands.',
  },
  {
    key: 'budget',
    label: 'Budget risk',
    icon: Wallet,
    blurb: 'Committed spend against the value of work delivered, with a forecast at completion.',
  },
  {
    key: 'material',
    label: 'Material risk',
    icon: Package,
    blurb: 'Consumption rate against stock on site and the time each supplier needs to deliver.',
  },
]

export default function Insights() {
  const toast = useToast()
  const { data: projects } = useAsync(() => api.projects.list(), [])
  const [projectId, setProjectId] = useState('')
  const [severity, setSeverity] = useState('')
  const { data, error, loading, reload, setData } = useAsync(
    () => api.ai.insights(projectId || undefined),
    [projectId],
  )
  const [refreshing, setRefreshing] = useState(false)
  const scope = useEnter([loading, Boolean(data)])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await api.ai.refresh(projectId || undefined)
      await reload()
      toast.success('Findings recalculated', 'Every figure was re-read from the live records')
    } catch (err) {
      toast.error('Could not recalculate', err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const onAcknowledged = (id) =>
    setData((current) => ({
      ...current,
      findings: current.findings.map((finding) =>
        finding.id === id ? { ...finding, acknowledged: true } : finding,
      ),
    }))

  const grouped = useMemo(() => {
    const findings = (data?.findings || []).filter(
      (finding) => !severity || finding.severity === severity,
    )
    return GROUPS.map((group) => ({
      ...group,
      findings: findings.filter((finding) => finding.kind === group.key),
    }))
  }, [data, severity])

  const positives = useMemo(
    () => (data?.findings || []).filter((finding) => finding.kind === 'positive'),
    [data],
  )

  if (error) {
    return <ErrorState title="We could not load the findings" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <PageHeader
        title="AI insights"
        description="Every project scored on schedule, cost and supply. Findings are ordered by impact, so the one at the top is the one costing you the most."
        actions={
          <Button variant="secondary" onClick={refresh} loading={refreshing}>
            <RefreshCw size={14} />
            Recalculate
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2" data-enter>
        <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-auto" aria-label="Filter by project">
          <option value="">Whole portfolio</option>
          {(projects || []).map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </Select>
        <Select value={severity} onChange={(event) => setSeverity(event.target.value)} className="w-auto" aria-label="Filter by severity">
          <option value="">All severities</option>
          <option value="high">High only</option>
          <option value="medium">Medium and above</option>
          <option value="low">Low</option>
        </Select>
        {data && (
          <div className="ml-auto flex items-center gap-4 text-tiny">
            <Count label="high" value={data.counts.high} className="text-critical" />
            <Count label="medium" value={data.counts.medium} className="text-amber-deep" />
            <Count label="tracking well" value={positives.length} className="text-healthy" />
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <PanelSkeleton key={group.key} rows={3} />
          ))}
        </div>
      ) : (data?.findings || []).length === 0 ? (
        <Panel data-enter>
          <EmptyState
            icon={Sparkles}
            title="Nothing needs your attention"
            description="No schedule slippage, cost overrun or stock shortage was detected. Recalculate after the next round of site reports."
            action={
              <Button variant="secondary" onClick={refresh} loading={refreshing}>
                <RefreshCw size={14} />
                Recalculate now
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {grouped.map((group) => (
            <section key={group.key} data-enter>
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <group.icon size={15} className="text-amber-deep" strokeWidth={2} />
                  <h2 className="font-display text-h4 text-ink">{group.label}</h2>
                  <span className="rounded-pill bg-raised px-2 py-0.5 text-micro tabular text-muted">
                    {group.findings.length}
                  </span>
                </div>
                <p className="mt-1.5 text-tiny leading-relaxed text-muted">{group.blurb}</p>
              </div>

              {group.findings.length === 0 ? (
                <Panel className="px-5 py-8 text-center">
                  <p className="text-base text-muted">No {group.label.toLowerCase()} on record.</p>
                </Panel>
              ) : (
                <div className="space-y-3">
                  {group.findings.map((finding) => (
                    <AIInsightCard key={finding.id} insight={finding} onAcknowledged={onAcknowledged} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {positives.length > 0 && (
        <section className="mt-8" data-enter>
          <h2 className="font-display text-h4 text-ink">Tracking well</h2>
          <p className="mt-1.5 text-tiny text-muted">
            Projects where the numbers say no intervention is needed.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {positives.map((finding) => (
              <AIInsightCard key={finding.id} insight={finding} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Count({ label, value, className }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={cn('font-display text-[0.9375rem] font-semibold tabular', className)}>{value}</span>
      <span className="text-muted">{label}</span>
    </span>
  )
}
