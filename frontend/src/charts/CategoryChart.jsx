import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import { formatINR, titleise } from '@/lib/format'
import { useChartTheme } from './useChartTheme'
import { ChartCard } from './ChartCard'
import { EmptyState } from '@/components/ui/States'
import { PieChart as PieIcon } from 'lucide-react'

/**
 * A donut, because the question here is "what share of spend is this" and the
 * categories are few. The centre carries the total, which is the number people
 * actually came for.
 */
export function CategoryChart({ data = [], title = 'Spend by category', height = 300 }) {
  const theme = useChartTheme()

  if (!data.length) {
    return (
      <ChartCard title={title} height={height}>
        <EmptyState compact icon={PieIcon} title="No categories yet" description="Spend splits appear once expenses are recorded." />
      </ChartCard>
    )
  }

  const total = data.reduce((sum, row) => sum + row.actual, 0)
  const sorted = [...data].sort((a, b) => b.actual - a.actual)

  return (
    <ChartCard title={title} height={height}>
      <div className="flex h-full flex-col items-center gap-5 px-3 sm:flex-row sm:gap-2">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sorted}
                dataKey="actual"
                nameKey="category"
                innerRadius={58}
                outerRadius={86}
                paddingAngle={1.5}
                stroke={theme.surface}
                strokeWidth={2}
                animationDuration={650}
              >
                {sorted.map((row, index) => (
                  <Cell key={row.category} fill={theme.series[index % theme.series.length]} />
                ))}
              </Pie>
              <Tooltip
                {...theme.tooltip}
                formatter={(value, name) => [formatINR(value), titleise(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-tiny text-muted">Total</span>
            <span className="font-display text-h4 tabular text-ink">{formatINR(total)}</span>
          </div>
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {sorted.map((row, index) => (
            <li key={row.category} className="flex items-center gap-2.5 text-base">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: theme.series[index % theme.series.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted">{titleise(row.category)}</span>
              <span className="tabular text-ink">{formatINR(row.actual)}</span>
              <span className="w-10 shrink-0 text-right text-tiny tabular text-subtle">
                {total ? Math.round((row.actual / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  )
}
