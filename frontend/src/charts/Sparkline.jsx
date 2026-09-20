import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { useChartTheme } from './useChartTheme'

/** A 40px trend, for inside a metric card. No axes: the shape is the message. */
export function Sparkline({ data = [], dataKey = 'value', tone = 'ink', height = 34 }) {
  const theme = useChartTheme()
  if (data.length < 2) return null
  const color = theme[tone] || theme.ink
  const id = `spark-${tone}-${dataKey}`

  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${id})`}
            dot={false}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
