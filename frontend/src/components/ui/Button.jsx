import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'

const VARIANTS = {
  primary:
    'bg-ink text-paper hover:bg-ink/90 active:bg-ink disabled:bg-ink/40',
  accent:
    'bg-amber text-[#1A1405] hover:bg-amber-deep hover:text-white active:bg-amber-deep disabled:opacity-50',
  secondary:
    'border border-line bg-surface text-ink hover:border-line-strong hover:bg-raised disabled:opacity-50',
  ghost:
    'text-muted hover:bg-raised hover:text-ink disabled:opacity-50',
  danger:
    'border border-critical/35 bg-critical-wash text-critical hover:border-critical/60 disabled:opacity-50',
}

const SIZES = {
  sm: 'h-8 px-3 text-tiny gap-1.5',
  md: 'h-9 px-3.5 text-base gap-2',
  lg: 'h-11 px-5 text-body gap-2',
  icon: 'h-9 w-9',
}

const BASE = [
  'inline-flex select-none items-center justify-center rounded-control font-medium',
  'transition-[background-color,border-color,color,transform,opacity] duration-150 ease-out',
  'active:scale-[0.975] disabled:pointer-events-none',
].join(' ')

/**
 * Press gives a small scale response so the click is felt; hover shifts
 * colour only. Nothing here moves on hover except elevation-bearing panels.
 */
export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', className, loading, disabled, href, children, ...props },
  ref,
) {
  // A download or external target is a link, whatever it looks like.
  if (href) {
    return (
      <a ref={ref} href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
        {children}
      </a>
    )
  }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
})

/** The same button, as a router link. Navigation is an anchor, not a button. */
export function ButtonLink({ to, href, variant = 'secondary', size = 'md', className, children, ...props }) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className)
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }
  return (
    <Link to={to} className={classes} {...props}>
      {children}
    </Link>
  )
}
