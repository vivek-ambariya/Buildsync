import { cn } from '@/lib/cn'

/**
 * The mark is an isometric cube drawn as a single continuous path — a volume
 * of built work — with the interior edges dropped back so it reads as a
 * structure rather than a box.
 */
export function LogoMark({ size = 28, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" className="fill-ink" />
      <path
        d="M8 22.5V9.5l8-4 8 4v13l-8 4-8-4Z"
        stroke="rgb(var(--amber))"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 13.5l8 4 8-4M16 17.5V26.5"
        stroke="rgb(var(--amber))"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  )
}

export function Logo({ size = 28, className, showWordmark = true, subtitle }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">
            BuildSync<span className="ml-[0.15em] text-amber-deep">AI</span>
          </span>
          {subtitle && <span className="mt-1 text-micro text-subtle">{subtitle}</span>}
        </span>
      )}
    </span>
  )
}
