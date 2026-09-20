import { useEffect, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Bell, CheckCircle2, FileText, Info } from 'lucide-react'

import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/format'
import { useAsync } from '@/lib/useAsync'
import { gsap, prefersReducedMotion } from '@/animations'
import { EmptyState } from './ui/States'
import { SkeletonText } from './ui/Skeleton'

const TONE = {
  critical: { icon: AlertTriangle, className: 'text-critical' },
  warning: { icon: AlertTriangle, className: 'text-amber-deep' },
  success: { icon: CheckCircle2, className: 'text-healthy' },
  info: { icon: Info, className: 'text-info' },
  document: { icon: FileText, className: 'text-info' },
}

export function NotificationPanel({ open, onClose, onReadAll }) {
  const panel = useRef(null)
  const { data, loading, reload, setData } = useAsync(() => api.notifications.list(), [open], {
    immediate: open,
  })

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: -8, scale: 0.985 },
      { opacity: 1, y: 0, scale: 1, duration: 0.24, ease: 'power3.out' },
    )
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    const onClickAway = (event) => {
      if (panel.current && !panel.current.contains(event.target)) onClose()
    }
    document.addEventListener('keydown', onKey)
    // Defer so the click that opened the panel does not immediately close it.
    const timer = setTimeout(() => document.addEventListener('mousedown', onClickAway), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickAway)
      clearTimeout(timer)
    }
  }, [open, onClose])

  const markAllRead = async () => {
    await api.notifications.markRead([], true)
    setData((current) => ({
      items: (current?.items || []).map((item) => ({ ...item, read: true })),
      unread: 0,
    }))
    onReadAll?.()
  }

  if (!open) return null
  const items = data?.items || []

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-surface shadow-overlay"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h3 className="panel-title">Notifications</h3>
        {items.some((item) => !item.read) && (
          <button
            type="button"
            onClick={markAllRead}
            className="text-tiny font-medium text-muted transition-colors hover:text-ink"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[24rem] overflow-y-auto">
        {loading ? (
          <div className="space-y-4 p-4">
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
            <SkeletonText lines={2} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon={Bell}
            title="Nothing to report"
            description="Alerts about delays, stock and reports land here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const { icon: Icon, className } = TONE[item.tone] || TONE.info
              const body = (
                <>
                  <span className="mt-0.5 shrink-0">
                    <Icon size={14} className={className} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="flex-1 text-base font-medium leading-snug text-ink">{item.title}</span>
                      {!item.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-label="Unread" />}
                    </span>
                    <span className="mt-0.5 block text-tiny leading-relaxed text-muted">{item.body}</span>
                    <span className="mt-1 block text-micro text-subtle">{relativeTime(item.created_at)}</span>
                  </span>
                </>
              )
              return (
                <li key={item.id}>
                  {item.link ? (
                    <Link
                      to={item.link}
                      onClick={onClose}
                      className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-raised', !item.read && 'bg-amber-wash/35')}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={cn('flex gap-3 px-4 py-3', !item.read && 'bg-amber-wash/35')}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-line bg-raised px-4 py-2.5">
        <button
          type="button"
          onClick={reload}
          className="text-tiny font-medium text-muted transition-colors hover:text-ink"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
