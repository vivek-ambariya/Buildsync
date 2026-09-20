import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/cn'

/**
 * Input controls for a person wearing gloves.
 *
 * The rule behind all of them: typing is the most expensive thing you can ask
 * for on a construction site, so every value that can be reached by tapping
 * is reached by tapping. A number gets steppers, a choice of four gets four
 * buttons rather than a select, and a percentage gets a track wide enough to
 * drag with a thumb.
 */

/** A number entered by pressing, with the keyboard still available in the middle. */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, suffix, label, id }) {
  const numeric = Number(value) || 0
  const clamp = (next) => Math.max(min, Math.min(max, next))

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(numeric - step))}
        disabled={numeric <= min}
        aria-label={`Decrease ${label || 'value'}`}
      >
        <Minus size={20} />
      </button>
      <div className="relative flex-1">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(event.target.value === '' ? '' : clamp(Number(event.target.value)))}
          className="h-12 w-full rounded-control border border-line bg-surface text-center font-display text-h4 font-semibold tabular text-ink
                     focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-amber/45"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-tiny text-subtle">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        className="stepper-btn"
        onClick={() => onChange(clamp(numeric + step))}
        disabled={numeric >= max}
        aria-label={`Increase ${label || 'value'}`}
      >
        <Plus size={20} />
      </button>
    </div>
  )
}

/** One of a few, chosen by tapping it. Never a dropdown for four options. */
export function ChipGroup({ options, value, onChange, columns, className }) {
  return (
    <div
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns || Math.min(options.length, 4)}, minmax(0, 1fr))` }}
      role="group"
    >
      {options.map((option) => {
        const optionValue = option.value ?? option
        const selected = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(optionValue)}
            className={cn('chip-choice', option.tone && selected && option.tone)}
          >
            {option.icon && <option.icon size={15} className="mr-1.5 shrink-0" />}
            <span className="truncate">{option.label ?? option}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * A percentage dragged with a thumb.
 *
 * The previous value is marked on the track, so the person can see how far
 * they have moved the work today without reading two numbers and subtracting.
 */
export function ProgressSlider({ value, previous = null, onChange, label = 'Progress' }) {
  const numeric = Number(value) || 0
  const delta = previous === null ? null : Math.round((numeric - previous) * 10) / 10

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <span className="field-label">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-h2 font-semibold tabular text-ink">{Math.round(numeric)}%</span>
          {delta !== null && delta !== 0 && (
            <span
              className={cn(
                'text-tiny font-medium tabular',
                delta > 0 ? 'text-healthy' : 'text-critical',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta} pts
            </span>
          )}
        </span>
      </div>

      <div className="relative">
        {previous !== null && previous > 0 && (
          <span
            className="pointer-events-none absolute top-1/2 z-10 h-4 w-0.5 -translate-y-1/2 rounded-pill bg-ink/35"
            style={{ left: `calc(${Math.max(0, Math.min(100, previous))}% - 1px)` }}
            title={`Was ${previous}%`}
            aria-hidden
          />
        )}
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={numeric}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="h-12 w-full cursor-pointer accent-ink"
          style={{ touchAction: 'pan-y' }}
        />
      </div>

      {/* Coarse jumps, for when the exact figure does not matter. */}
      <div className="mt-1 flex gap-2">
        {[25, 50, 75, 100].map((mark) => (
          <button
            key={mark}
            type="button"
            onClick={() => onChange(mark)}
            className="flex-1 rounded-control border border-line py-1.5 text-tiny font-medium tabular text-muted transition-colors active:bg-raised"
          >
            {mark}%
          </button>
        ))}
      </div>
    </div>
  )
}

/** A labelled block in a field form. Bigger label, more air than the office form. */
export function FieldBlock({ label, hint, required, children, className }) {
  return (
    <div className={cn('', className)}>
      {label && (
        <div className="mb-2 flex items-center gap-1">
          <span className="text-tiny font-semibold uppercase tracking-[0.05em] text-muted">{label}</span>
          {required && <span className="text-critical">*</span>}
        </div>
      )}
      {children}
      {hint && <p className="mt-1.5 text-tiny leading-snug text-subtle">{hint}</p>}
    </div>
  )
}

export const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium', tone: '!border-amber !bg-amber-wash !text-amber-deep' },
  { value: 'high', label: 'High', tone: '!border-critical/60 !bg-critical-wash !text-critical' },
  { value: 'critical', label: 'Critical', tone: '!border-critical !bg-critical !text-white' },
]

export const PHOTO_CATEGORIES = [
  { value: 'foundation', label: 'Foundation' },
  { value: 'structure', label: 'Structure' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'other', label: 'Other' },
]
