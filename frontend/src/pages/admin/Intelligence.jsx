import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Info, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'

import { adminService } from '@/services'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, formatPercent, titleise } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { AIInsightCard } from '@/components/AIInsightCard'
import { MetricCard } from '@/components/MetricCard'
import { Button } from '@/components/ui/Button'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { MetricSkeleton, PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const BANDS = {
  high: { label: 'High risk', chip: 'border-critical/25 bg-critical-wash text-critical', bar: 'critical' },
  medium: { label: 'Medium risk', chip: 'border-amber/35 bg-amber-wash text-amber-deep', bar: 'warning' },
  low: { label: 'Low risk', chip: 'border-healthy/25 bg-healthy-wash text-healthy', bar: 'healthy' },
}

const FEATURE_LABELS = {
  planned_duration_days: 'Planned duration',
  elapsed_days: 'Days elapsed',
  progress_variance_pct: 'Progress vs plan',
  material_availability_pct: 'Material availability',
  material_delay_days: 'Material lead-time exposure',
  labor_count: 'Workers on site',
  previous_delay_count: 'Tasks already delayed',
  budget_variance_pct: 'Budget variance',
  deadline_days_remaining: 'Days to deadline',
  task_completion_rate_pct: 'Tasks completed',
}

export default function AdminIntelligence() {
  const toast = useToast()
  const { data, error, loading, reload, setData } = useAsync(() => adminService.ai(), [])
  const [refreshing, setRefreshing] = useState(false)
  const scope = useEnter([loading, Boolean(data)])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const result = await adminService.refreshAi()
      setData(result)
      toast.success(`Re-analysed the portfolio.`, `${result.generated} findings across ${result.counts.analysed} projects.`)
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot run risk analysis.' : err.message)
    } finally {
      setRefreshing(false)
    }
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load project intelligence"
        description={error.message}
        onRetry={reload}
      />
    )
  }

  const model = data?.model
  const counts = data?.counts
  const scored = (data?.projects || []).filter((row) => row.delay_probability !== null)
  const unscored = (data?.projects || []).filter((row) => row.delay_probability === null)
  const attention = scored.filter((row) => row.risk_band !== 'low')

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="AI project intelligence"
        description="Every project scored by the trained delay model, ranked by the probability it finishes late."
        actions={
          <Button variant="secondary" onClick={refresh} loading={refreshing}>
            <RefreshCw size={14} />
            Re-run analysis
          </Button>
        }
      />

      {/* The model is named before any number it produced, so a reader always
          knows what is behind the percentages. */}
      <div data-enter className="mb-4">
        {loading && !data ? (
          <PanelSkeleton rows={1} title={false} />
        ) : model?.available ? (
          <Panel className="flex flex-wrap items-center gap-x-8 gap-y-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-panel border border-line bg-raised text-ink">
                <Brain size={17} strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-base font-medium text-ink">{titleise(model.name)}</p>
                <p className="text-tiny text-subtle">
                  trained on {model.trained_on_rows?.toLocaleString()} projects
                </p>
              </div>
            </div>
            {model.roc_auc !== null && model.roc_auc !== undefined && (
              <ModelStat label="ROC-AUC" value={model.roc_auc.toFixed(3)} />
            )}
            {model.precision !== null && model.precision !== undefined && (
              <ModelStat label="Precision" value={formatPercent(model.precision * 100)} />
            )}
            {model.recall !== null && model.recall !== undefined && (
              <ModelStat label="Recall" value={formatPercent(model.recall * 100)} />
            )}
            <ModelStat label="Flag threshold" value={formatPercent(model.threshold * 100)} />
          </Panel>
        ) : (
          // No bundle on disk: say so rather than showing a number nobody computed.
          <Panel className="flex items-start gap-3 p-5">
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-deep" />
            <div>
              <p className="text-base font-medium text-ink">Risk model unavailable</p>
              <p className="mt-1 text-tiny leading-relaxed text-muted">
                The trained delay model could not be loaded, so no delay probabilities are
                shown. Run <code className="font-mono text-ink">python ml/train_model.py</code>{' '}
                to produce it. The rule-based findings below are unaffected.
              </p>
            </div>
          </Panel>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />)
        ) : (
          <>
            <div data-enter>
              <MetricCard
                label="Projects analysed"
                value={counts.analysed}
                caption={unscored.length ? `${unscored.length} could not be scored` : 'the whole portfolio'}
              />
            </div>
            <div data-enter>
              <MetricCard
                label="High risk"
                value={counts.high}
                tone={counts.high > 0 ? 'critical' : 'healthy'}
                rule={counts.high > 0 ? 'critical' : 'healthy'}
                caption="60% or more likely to slip"
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Medium risk"
                value={counts.medium}
                tone={counts.medium > 0 ? 'warning' : 'neutral'}
                caption="between 35% and 60%"
              />
            </div>
            <div data-enter>
              <MetricCard
                label="Low risk"
                value={counts.low}
                tone="healthy"
                caption="under 35%"
              />
            </div>
          </>
        )}
      </div>

      {/* Headline sentence, matching what the numbers actually say. */}
      {data && (
        <div data-enter className="mt-6">
          <h2 className="font-display text-h4 text-ink">
            {attention.length === 0
              ? 'No project is flagged as at risk of delay'
              : `${attention.length} ${attention.length === 1 ? 'project requires' : 'projects require'} attention`}
          </h2>
          <p className="mt-1 text-tiny text-muted">
            {attention.length === 0
              ? 'Every scored project sits below the medium-risk threshold.'
              : 'Ranked by the model’s delay probability, highest first.'}
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, index) => <PanelSkeleton key={index} rows={2} title={false} />)
          : scored.map((row) => <RiskCard key={row.id} row={row} />)}
      </div>

      {unscored.length > 0 && (
        <div data-enter className="mt-4">
          <Panel className="p-5">
            <div className="flex items-start gap-3">
              <Info size={16} className="mt-0.5 shrink-0 text-subtle" />
              <div>
                <p className="text-base font-medium text-ink">
                  {unscored.length} {unscored.length === 1 ? 'project' : 'projects'} could not be scored
                </p>
                <p className="mt-1 text-tiny leading-relaxed text-muted">
                  {unscored.map((row) => row.name).join(', ')}. No probability is shown for these
                  rather than an estimated one.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Rule-based findings, which explain *why* in plain language. */}
      <section data-enter className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-h4 text-ink">Recent findings</h2>
            <p className="mt-0.5 text-tiny text-muted">
              {data?.insight_counts
                ? `${data.insight_counts.total} open · ${data.insight_counts.high} high severity`
                : 'Schedule, budget and material risks detected across the portfolio'}
            </p>
          </div>
          <Link
            to="/app/insights"
            className="text-tiny font-medium text-muted transition-colors hover:text-ink"
          >
            Open the findings board
          </Link>
        </div>

        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <PanelSkeleton rows={2} title={false} />
            <PanelSkeleton rows={2} title={false} />
          </div>
        ) : data.insights.length === 0 ? (
          <Panel>
            <EmptyState
              compact
              icon={Sparkles}
              title="Nothing needs attention"
              description="No schedule, budget or material risks were detected across the portfolio."
            />
          </Panel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.insights.map((insight) => (
              <AIInsightCard key={insight.id} insight={insight} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ModelStat({ label, value }) {
  return (
    <div>
      <p className="text-micro text-subtle">{label}</p>
      <p className="mt-0.5 font-display text-[0.9375rem] font-semibold tabular text-ink">{value}</p>
    </div>
  )
}

function RiskCard({ row }) {
  const band = BANDS[row.risk_band] || BANDS.low
  const prediction = row.prediction
  const clamped = prediction?.clamped_features || []

  return (
    <Panel data-enter interactive className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/app/projects/${row.id}`}
            className="block truncate font-display text-h4 text-ink transition-colors hover:text-amber-deep"
          >
            {row.name}
          </Link>
          <p className="mt-0.5 truncate text-tiny text-subtle">
            {row.code} · {row.manager_name}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap rounded-pill border px-2.5 py-1 text-tiny font-medium',
            band.chip,
          )}
        >
          {band.label}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-metric font-semibold tabular text-ink">
            {row.delay_probability}%
          </p>
          <p className="text-tiny text-muted">delay probability</p>
        </div>
        <div className="text-right">
          <p className="text-tiny tabular text-ink">{formatPercent(row.progress)} complete</p>
          <p
            className={cn(
              'text-micro tabular',
              row.variance < -4 ? 'text-critical' : 'text-subtle',
            )}
          >
            {row.variance > 0 ? '+' : ''}
            {row.variance.toFixed(1)} pts vs plan
          </p>
        </div>
      </div>

      <ProgressBar
        value={row.delay_probability}
        tone={band.bar}
        className="mt-3"
        showPlannedMarker={false}
      />

      {prediction?.drivers?.length > 0 && (
        <dl className="mt-4 space-y-1.5 border-t border-line pt-3.5">
          <p className="text-micro text-subtle">What is moving this score</p>
          {prediction.drivers.map((driver) => (
            <div key={driver.feature} className="flex items-baseline justify-between gap-3 text-tiny">
              <dt className="min-w-0 truncate text-muted">
                {FEATURE_LABELS[driver.feature] || driver.feature}
              </dt>
              <dd className="shrink-0 tabular text-ink">{driver.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-subtle">
        <span>Forecast finish {formatDate(row.forecast_end)}</span>
        {row.delay_days > 0 && <span className="text-critical">{row.delay_days}d late</span>}
        <StatusBadge status={row.status} size="sm" />
      </div>

      {clamped.length > 0 && (
        // Being explicit about this matters: it is the difference between a
        // supported estimate and a confident-looking extrapolation.
        <p className="mt-3 text-micro leading-relaxed text-subtle">
          {clamped.length === 1 ? 'One input' : `${clamped.length} inputs`} sat outside the
          range the model was trained on and{' '}
          {clamped.length === 1 ? 'was' : 'were'} capped to its limits, so this score is
          conservative.
        </p>
      )}
    </Panel>
  )
}
