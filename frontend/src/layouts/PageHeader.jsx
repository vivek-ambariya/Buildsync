import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/cn'

/** Every screen opens the same way: where you are, what it is, what you can do. */
export function PageHeader({ eyebrow, backTo, backLabel, title, description, actions, children, className }) {
  return (
    <header className={cn('mb-6', className)} data-enter>
      {backTo && (
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1.5 text-tiny font-medium text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} />
          {backLabel || 'Back'}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-tiny font-medium text-muted">{eyebrow}</p>}
          <h1 className="font-display text-h2 text-ink">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-body text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}
