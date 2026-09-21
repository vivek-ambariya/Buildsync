import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Package, TrendingDown, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { useAuth } from '@/lib/auth'
import { projectPath } from '@/lib/workspaces'
import { Panel } from './ui/Panel'

const KIND_ICON = {
  schedule: TrendingDown,
  budget: Wallet,
  material: Package,
  quality: AlertTriangle,
  positive: CheckCircle2,
}

const SEVERITY = {
  high: { rule: 'text-critical', chip: 'border-critical/25 bg-critical-wash text-critical', label: 'High' },
  medium: { rule: 'text-amber', chip: 'border-amber/35 bg-amber-wash text-amber-deep', label: 'Medium' },
  low: { rule: 'text-healthy', chip: 'border-healthy/25 bg-healthy-wash text-healthy', label: 'Low' },
}

/**
 * A finding, written to be acted on: what is happening, the number behind it,
 * and the next step. The severity is a chalked rule down the left edge.
 */
export function AIInsightCard({ insight, onAcknowledged, compact = false }) {
  const toast = useToast()
  const { home } = useAuth()
  const [acknowledging, setAcknowledging] = useState(false)
  const severity = SEVERITY[insight.severity] || SEVERITY.low
  const Icon = KIND_ICON[insight.kind] || AlertTriangle

  const acknowledge = async () => {
    setAcknowledging(true)
    try {
      await api.ai.acknowledge(insight.id)
      toast.success('Finding acknowledged', insight.title)
      onAcknowledged?.(insight.id)
    } catch (error) {
      toast.error('Could not acknowledge that finding', error.message)
    } finally {
      setAcknowledging(false)
    }
  }

  return (
    <Panel
      interactive
      className={cn('rule-left', severity.rule, insight.acknowledged && 'opacity-60')}
    >
      <div className={cn('pl-4', compact ? 'p-4 pl-5' : 'p-5 pl-6')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Icon size={13} className={cn('shrink-0', severity.rule)} strokeWidth={2} />
              <Link
                to={projectPath(home, insight.project_id)}
                className="truncate text-tiny font-medium text-muted transition-colors hover:text-ink"
              >
                {insight.project_name}
              </Link>
            </div>
            <h4 className="mt-1.5 font-display text-[0.9375rem] font-semibold leading-snug text-ink">
              {insight.title}
            </h4>
          </div>
          <span className={cn('shrink-0 rounded-pill border px-2 py-0.5 text-micro font-medium', severity.chip)}>
            {severity.label}
          </span>
        </div>

        <p className="mt-2 text-base leading-relaxed text-muted">{insight.summary}</p>

        <div className="mt-4 flex flex-wrap items-stretch gap-x-6 gap-y-3 border-t border-line pt-3.5">
          <Measure label={insight.metric_label} value={insight.metric_value} tone={severity.rule} />
          {insight.secondary_label && (
            <Measure label={insight.secondary_label} value={insight.secondary_value} />
          )}
          <div className="ml-auto flex items-end">
            <span className="text-micro text-subtle tabular">
              {Math.round((insight.confidence || 0) * 100)}% confidence
            </span>
          </div>
        </div>

        {insight.recommendation && (
          <div className="mt-3.5 flex items-start gap-2 rounded-control bg-raised px-3 py-2.5">
            <ArrowRight size={13} className="mt-0.5 shrink-0 text-subtle" />
            <p className="text-tiny leading-relaxed text-muted">{insight.recommendation}</p>
          </div>
        )}

        {!compact && !insight.acknowledged && (
          <button
            type="button"
            onClick={acknowledge}
            disabled={acknowledging}
            className="mt-3.5 inline-flex items-center gap-1.5 text-tiny font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <Check size={13} />
            Acknowledge
          </button>
        )}
      </div>
    </Panel>
  )
}

function Measure({ label, value, tone }) {
  return (
    <div>
      <p className="text-micro text-subtle">{label}</p>
      <p className={cn('mt-0.5 font-display text-[1.0625rem] font-semibold tabular', tone || 'text-ink')}>
        {value}
      </p>
    </div>
  )
}
