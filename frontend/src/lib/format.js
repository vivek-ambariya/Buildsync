/** Formatting helpers. Budgets are quoted the way they are on site: crore and lakh. */

const CRORE = 10_000_000
const LAKH = 100_000

export function formatINR(amount, { compact = true } = {}) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  const value = Number(amount)
  if (!compact) return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  const abs = Math.abs(value)
  if (abs >= CRORE) return `₹${(value / CRORE).toFixed(2)} Cr`
  if (abs >= LAKH) return `₹${(value / LAKH).toFixed(2)} L`
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export const formatPercent = (value, digits = 0) =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : `${Number(value).toFixed(digits)}%`

export const formatSigned = (value, digits = 1) =>
  value === null || value === undefined || Number.isNaN(value)
    ? '—'
    : `${value > 0 ? '+' : ''}${Number(value).toFixed(digits)}`

export function formatDate(value, { withYear = true } = {}) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  })
}

export function formatDateLong(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function relativeTime(value) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(seconds)) return ''
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatDate(date)
}

export function daysUntil(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

/** "at_risk" -> "At risk". Enum values are stored snake_case everywhere. */
export function titleise(value) {
  if (!value) return ''
  const words = String(value).replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function fileSize(bytes) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/)
  if (!parts[0]) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}


/** Document types read as acronyms or phrases, not as title-cased slugs. */
export const DOCUMENT_TYPE_LABELS = {
  boq: 'BOQ',
  invoice: 'Invoice',
  contract: 'Contract',
  site_report: 'Site report',
  drawing: 'Drawing',
  other: 'Other',
}

export const documentTypeLabel = (value) =>
  DOCUMENT_TYPE_LABELS[value] || titleise(value)
