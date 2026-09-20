import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useChartTheme } from './useChartTheme'
import { ChartCard } from './ChartCard'
import { EmptyState } from '@/components/ui/States'
import { TrendingUp } from 'lucide-react'

/**
 * Planned against actual. The plan is a dashed reference line and the actual
 * is the filled area, so "where we are" reads as the substance and "where we
 * should be" reads as the benchmark.
 */
export function ProgressChart({ data = [], title = 'Planned against actual progress', description, height = 300, fill = false }) {
  const theme = useChartTheme()

  if (!data.length) {
    return (
      <ChartCard title={title} description={description} height={height}>
        <EmptyState
          compact
          icon={TrendingUp}
          title="No progress recorded yet"
          description="The curve appears once site reports start coming in."
        />
      </ChartCard>
    )
  }

  const gap = data.length ? (data[data.length - 1].actual - data[data.length - 1].planned).toFixed(1) : 0

  // A 0-100 axis buries a 10-point gap in white space. The window is padded
  // around the data instead, rounded to tens so the gridlines stay readable.
  const values = data.flatMap((point) => [point.planned, point.actual])
  const floor = Math.max(0, Math.floor((Math.min(...values) - 6) / 10) * 10)
  const ceiling = Math.min(100, Math.ceil((Math.max(...values) + 6) / 10) * 10)

  return (
    <ChartCard
      title={title}
      description={description || `Actual is ${gap > 0 ? `${gap} points ahead of` : `${Math.abs(gap)} points behind`} plan`}
      height={height}
      className={fill ? 'h-full' : undefined}
      legend={[
        { label: 'Actual', color: theme.ink },
        { label: 'Planned', color: theme.amber, dashed: true },
      ]}
    >
      <ResponsiveContainer width="100%" height={fill ? '100%' : height - 60}>
        <ComposedChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="actual-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.ink} stopOpacity={0.14} />
              <stop offset="100%" stopColor={theme.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...theme.grid} />
          <XAxis dataKey="label" {...theme.axis} dy={6} interval="preserveStartEnd" />
          <YAxis
            {...theme.axis}
            width={46}
            domain={[floor, ceiling]}
            tickCount={Math.min(7, Math.round((ceiling - floor) / 10) + 1)}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            {...theme.tooltip}
            formatter={(value, name) => [`${value}%`, name === 'actual' ? 'Actual' : 'Planned']}
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke={theme.ink}
            strokeWidth={2}
            fill="url(#actual-fill)"
            dot={false}
            activeDot={{ r: 3.5, fill: theme.ink, stroke: theme.surface, strokeWidth: 2 }}
            animationDuration={700}
          />
          <Line
            type="monotone"
            dataKey="planned"
            stroke={theme.amber}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            animationDuration={700}
            animationBegin={120}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
