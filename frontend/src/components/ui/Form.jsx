import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/cn'

export function Field({ label, hint, error, required, children, className }) {
  return (
    <label className={cn('block', className)}>
      {label && (
        <span className="field-label mb-1.5 flex items-center gap-1">
          {label}
          {required && <span className="text-critical">*</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-tiny text-critical">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-tiny text-subtle">{hint}</span>
      ) : null}
    </label>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn('input', className)} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn('input resize-y', className)} {...props} />
})

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn('input appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle"
      />
    </div>
  )
})

export function FieldRow({ children, className }) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
}
