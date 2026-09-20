import {
  FileText, Hammer, IndianRupee, ListChecks, Package, Sparkles, UploadCloud,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import { EmptyState } from './ui/States'

const ICONS = {
  site_update: Hammer,
  document: UploadCloud,
  task: ListChecks,
  material: Package,
  expense: IndianRupee,
  report: FileText,
  project: Sparkles,
}

/**
 * A continuous rule runs down the feed and each event hangs off it, so the
 * sequence reads as one thread rather than a stack of rows.
 */
export function ActivityTimeline({ items = [], className }) {
  if (!items.length) {
    return (
      <EmptyState
        compact
        icon={Hammer}
        title="No activity yet"
        description="Site reports, uploads and task updates will appear here as they happen."
      />
    )
  }

  return (
    <ol className={cn('relative', className)}>
      <span className="absolute bottom-3 left-[15px] top-3 w-px bg-line" aria-hidden />
      {items.map((item) => {
        const Icon = ICONS[item.entity_type] || Sparkles
        return (
          <li key={item.id} className="relative flex gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="relative z-10 mt-0.5 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border border-line bg-surface text-subtle">
              <Icon size={13} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base leading-snug text-ink">
                <span className="font-medium">{item.actor_name}</span>{' '}
                <span className="text-muted">{item.action}</span>
              </p>
              {item.detail && <p className="mt-0.5 truncate text-tiny text-muted">{item.detail}</p>}
              <p className="mt-0.5 text-micro text-subtle">{relativeTime(item.created_at)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
