/**
 * Schedule variance, expressed as presentation.
 *
 * Tailwind only compiles classes it can see written out in full, so these are
 * literal strings in a lookup rather than built with a template literal — a
 * `text-${tone}` would silently compile to nothing and fall back to black.
 */

export const VARIANCE_TONE = {
  healthy: {
    key: 'healthy',
    rule: 'text-healthy',
    text: 'text-healthy',
    bar: 'healthy',
    chip: 'border-healthy/25 bg-healthy-wash text-healthy',
  },
  warning: {
    key: 'warning',
    rule: 'text-amber',
    text: 'text-amber-deep',
    bar: 'warning',
    chip: 'border-amber/35 bg-amber-wash text-amber-deep',
  },
  critical: {
    key: 'critical',
    rule: 'text-critical',
    text: 'text-critical',
    bar: 'critical',
    chip: 'border-critical/25 bg-critical-wash text-critical',
  },
}

/** Points behind plan, mapped to how alarming that is. */
export function toneForVariance(variance = 0) {
  if (variance <= -12) return VARIANCE_TONE.critical
  if (variance < -4) return VARIANCE_TONE.warning
  return VARIANCE_TONE.healthy
}

/** Spend running ahead of delivered work, as a percentage over. */
export function toneForOverrun(overrun = 0) {
  if (overrun > 15) return VARIANCE_TONE.critical
  if (overrun > 7) return VARIANCE_TONE.warning
  return VARIANCE_TONE.healthy
}
