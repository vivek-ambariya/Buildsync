import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { relativeTime } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

/**
 * What has changed since you last looked.
 *
 * On site this is mostly things the project manager has done to your day —
 * a task assigned, a deadline moved, a material request answered — so it is
 * a full screen rather than a dropdown, and unread items carry an amber rule
 * you can find without reading.
 */
const TONE_RULE = {
  critical: 'rule-left border-critical/30 text-critical',
  warning: 'rule-left border-amber/40 text-amber',
  info: 'rule-left border-info/30 text-info',
}

export default function SiteNotifications() {
  const { workspace } = useAuth()
  const { data, error, loading, reload } = useAsync(() => api.notifications.list(), [])
  const [marking, setMarking] = useState(false)
  const scope = useEnter([loading, Boolean(data)])

  const markAll = async () => {
    setMarking(true)
    try {
      await api.notifications.markRead([], true)
      await reload()
    } finally {
      setMarking(false)
    }
  }

  if (error) {
    return <ErrorState title="We could not load your notifications" description={error.message} onRetry={reload} />
  }

  const items = data?.items || []
  const unread = data?.unread || 0

  return (
    <div ref={scope}>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-h3 leading-tight text-ink">Notifications</h1>
          <p className="mt-0.5 text-tiny text-muted">
            <span className="tabular text-ink">{unread}</span> unread
          </p>
        </div>
        {unread > 0 && (
          <Button variant="secondary" loading={marking} onClick={markAll}>
            <Check size={15} />
            Mark all read
          </Button>
        )}
      </header>

      {loading && !data ? (
        <div className="space-y-2" data-enter>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-panel border border-line p-4">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="mt-2 h-2.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={Bell}
            title="Nothing new"
            description="Task assignments, deadline changes and answers to your material requests land here."
          />
        </div>
      ) : (
        <ul className="space-y-2" data-enter>
          {items.map((item) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className={cn('min-w-0 flex-1 text-base leading-snug', item.read ? 'text-muted' : 'font-medium text-ink')}>
                    {item.title}
                  </p>
                  {!item.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber" aria-label="Unread" />}
                </div>
                {item.body && <p className="mt-1 text-tiny leading-relaxed text-muted">{item.body}</p>}
                <p className="mt-1.5 text-micro text-subtle">{relativeTime(item.created_at)}</p>
              </>
            )

            const className = cn(
              'block rounded-panel border bg-surface p-4',
              item.read ? 'border-line' : TONE_RULE[item.tone] || 'rule-left border-amber/40 text-amber',
            )
            const inner = <div className={cn(!item.read && 'pl-2.5')}>{body}</div>

            return (
              <li key={item.id}>
                {/* A notification about a site thing goes to the site app, not
                    the portfolio route the API wrote for a manager. */}
                {item.project_id ? (
                  <Link to={workspace?.base || "/site-manager"} className={cn(className, 'transition-colors active:bg-raised')}>
                    {inner}
                  </Link>
                ) : (
                  <div className={className}>{inner}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
