import { useEffect, useMemo, useState } from 'react'

import { useTheme } from '@/lib/theme'

const VARIABLES = [
  'ink', 'muted', 'subtle', 'line', 'line-strong', 'surface', 'raised',
  'amber', 'amber-deep', 'healthy', 'warning', 'critical', 'info',
]

const read = () => {
  if (typeof window === 'undefined') return {}
  const styles = getComputedStyle(document.documentElement)
  return VARIABLES.reduce((out, name) => {
    const channels = styles.getPropertyValue(`--${name}`).trim()
    out[name] = channels ? `rgb(${channels})` : '#000'
    out[`${name}Raw`] = channels
    return out
  }, {})
}

/**
 * Charts read their colours from the same CSS variables as the rest of the
 * interface, so a theme change moves everything together.
 */
export function useChartTheme() {
  const { theme } = useTheme()
  const [colors, setColors] = useState(read)

  useEffect(() => {
    // Wait a frame so the variables have been applied to <html> first.
    const id = requestAnimationFrame(() => setColors(read()))
    return () => cancelAnimationFrame(id)
  }, [theme])

  return useMemo(
    () => ({
      ...colors,
      alpha: (name, value) => `rgb(${colors[`${name}Raw`]} / ${value})`,
      axis: {
        stroke: colors.line,
        tick: { fill: colors.subtle, fontSize: 11 },
        tickLine: false,
        axisLine: false,
      },
      grid: { stroke: colors.line, strokeDasharray: '0', vertical: false },
      tooltip: {
        contentStyle: {
          background: colors.surface,
          border: `1px solid ${colors.line}`,
          borderRadius: 8,
          boxShadow: '0 6px 16px -4px rgb(0 0 0 / 0.14)',
          fontSize: 12,
          padding: '8px 10px',
        },
        labelStyle: { color: colors.ink, fontWeight: 600, marginBottom: 4 },
        itemStyle: { color: colors.muted, padding: 0 },
      },
      /** Categorical series order. Amber leads because it is the brand accent. */
      series: [colors.ink, colors.amber, colors.info, colors.healthy, colors['line-strong'], colors.critical],
    }),
    [colors],
  )
}
