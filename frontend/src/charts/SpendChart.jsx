import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatINR } from '@/lib/format'
import { useChartTheme } from './useChartTheme'
import { ChartCard } from './ChartCard'
import { EmptyState } from '@/components/ui/States'
import { IndianRupee } from 'lucide-react'

const shortINR = (value) => {
  const crore = 10_000_000
  const lakh = 100_000
  if (Math.abs(value) >= crore) return `${(value / crore).toFixed(1)}Cr`
  if (Math.abs(value) >= lakh) return `${(value / lakh).toFixed(0)}L`
  return value
}

export function SpendChart({ data = [], title = 'Spend by month', description, height = 300, xKey = 'label' }) {
  const theme = useChartTheme()

  if (!data.length) {
    return (
      <ChartCard title={title} height={height}>
        <EmptyState compact icon={IndianRupee} title="No spend recorded" description="Costs appear here once expenses are logged." />
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title={title}
      description={description}
      height={height}
      legend={[
        { label: 'Actual', color: theme.ink },
        { label: 'Planned', color: theme['line-strong'] },
      ]}
    >
      <ResponsiveContainer width="100%" height={height - 60}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -6, bottom: 0 }} barGap={3}>
          <CartesianGrid {...theme.grid} />
          <XAxis dataKey={xKey} {...theme.axis} dy={6} />
          <YAxis {...theme.axis} width={52} tickFormatter={shortINR} />
          <Tooltip
            {...theme.tooltip}
            formatter={(value, name) => [formatINR(value), name === 'actual' ? 'Actual' : 'Planned']}
            cursor={{ fill: theme.alpha('ink', 0.04) }}
          />
          <Bar dataKey="planned" fill={theme['line-strong']} radius={[3, 3, 0, 0]} animationDuration={600} />
          <Bar dataKey="actual" fill={theme.ink} radius={[3, 3, 0, 0]} animationDuration={600} animationBegin={90} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
