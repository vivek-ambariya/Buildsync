import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useCountUp } from '@/animations/useMotion'
import { Panel } from './ui/Panel'
import { Sparkline } from '@/charts/Sparkline'

const TONES = {
  neutral: 'text-ink',
  healthy: 'text-healthy',
  warning: 'text-amber-deep',
  critical: 'text-critical',
  info: 'text-info',
}

/**
 * The headline figure of a screen.
 *
 * The number counts up once, when it first arrives, because a metric landing
 * is worth noticing. It does not re-animate on every re-render.
 */
export function MetricCard({
  label,
  value,
  format,
  caption,
  trend,
  trendLabel,
  tone = 'neutral',
  spark,
  sparkTone,
  rule,
  className,
}) {
  const numeric = typeof value === 'number'
  const valueRef = useCountUp(numeric ? value : null, format)
  const TrendIcon = trend === undefined || trend === null || trend === 0 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight
  const trendTone =
    trend === undefined || trend === null || trend === 0
      ? 'text-subtle'
      : trend > 0
        ? 'text-healthy'
        : 'text-critical'

  return (
    <Panel
      interactive
      className={cn('group flex flex-col justify-between p-5', rule && 'rule-left', TONES[rule] || '', className)}
    >
      <div className={cn(rule && 'pl-3')}>
        <p className="text-tiny font-medium text-muted">{label}</p>
        <p
          data-metric
          className={cn('mt-2.5 font-display text-metric font-semibold', TONES[tone])}
        >
          {numeric ? <span ref={valueRef}>{format ? format(0) : 0}</span> : value}
        </p>
      </div>

      <div className={cn('mt-4 flex items-end justify-between gap-3', rule && 'pl-3')}>
        <div className="min-w-0">
          {(trend !== undefined && trend !== null) && (
            <span className={cn('inline-flex items-center gap-1 text-tiny font-medium tabular', trendTone)}>
              <TrendIcon size={13} strokeWidth={2.25} />
              {typeof trend === 'number' ? `${trend > 0 ? '+' : ''}${trend}` : trend}
              {trendLabel && <span className="font-normal text-subtle">{trendLabel}</span>}
            </span>
          )}
          {caption && <p className="mt-0.5 truncate text-tiny text-subtle">{caption}</p>}
        </div>
        {spark?.length > 1 && (
          <div className="hidden w-20 shrink-0 opacity-70 transition-opacity duration-200 group-hover:opacity-100 sm:block">
            <Sparkline data={spark} tone={sparkTone || (tone === 'neutral' ? 'ink' : tone)} />
          </div>
        )}
      </div>
    </Panel>
  )
}
