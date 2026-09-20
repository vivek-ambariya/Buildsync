import { useState } from 'react'
import { AlertTriangle, CalendarClock, Check, Ban, Users } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useToast } from '@/lib/toast'
import { daysUntil, formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { ProgressUpdateSheet } from './ProgressUpdateSheet'

/**
 * A task as it reads on site.
 *
 * The four facts a site manager needs before deciding whether to walk over to
 * it — how far, how many people, when it is due, what state it is in — then
 * one full-width primary action. Everything else the task can do is behind a
 * secondary row, because "Update progress" is what happens ninety per cent of
 * the time and it should never be a target you have to aim at.
 */
export function TaskCard({ task, workers, onChanged, compact }) {
  const [updating, setUpdating] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const due = daysUntil(task.deadline)
  const dueLabel =
    task.status === 'completed'
      ? 'Complete'
      : due === 0
        ? 'Today'
        : due === 1
          ? 'Tomorrow'
          : due < 0
            ? `${Math.abs(due)} day${Math.abs(due) === 1 ? '' : 's'} overdue`
            : formatDate(task.deadline, { withYear: false })

  return (
    <>
      <article
        className={cn(
          'rounded-panel border bg-surface p-4',
          task.blocked
            ? 'rule-left border-critical/30 text-critical'
            : task.overdue
              ? 'rule-left border-amber/40 text-amber'
              : 'border-line',
        )}
      >
        <div className={cn((task.blocked || task.overdue) && 'pl-2.5')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-[1.0625rem] font-semibold leading-tight text-ink">{task.title}</h3>
              <p className="mt-1 truncate text-tiny text-subtle">
                {task.phase}
                {task.project_name && !compact && ` · ${task.project_name}`}
              </p>
            </div>
            <StatusBadge status={task.status} size="sm" className="shrink-0" />
          </div>

          {task.blocked && task.blocked_reason && (
            <p className="mt-3 flex items-start gap-2 rounded-control bg-critical-wash px-3 py-2.5 text-tiny leading-relaxed text-critical">
              <Ban size={13} className="mt-0.5 shrink-0" />
              {task.blocked_reason}
            </p>
          )}

          {/* The three figures, sized so they can be read at arm's length. */}
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Figure label="Progress" value={`${Math.round(task.progress || 0)}%`} />
            <Figure
              label="Workers"
              value={workers ?? '—'}
              icon={Users}
            />
            <Figure
              label="Deadline"
              value={dueLabel}
              icon={CalendarClock}
              tone={due !== null && due < 0 && task.status !== 'completed' ? 'text-critical' : undefined}
            />
          </dl>

          <ProgressBar
            value={task.progress || 0}
            tone={task.blocked ? 'critical' : task.overdue ? 'warning' : 'ink'}
            showPlannedMarker={false}
            className="mt-3"
          />

          <div className="mt-4 space-y-2">
            <Button variant="accent" size="lg" className="w-full" onClick={() => setUpdating(true)}>
              Update progress
            </Button>
            {task.status !== 'completed' && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setBlocking(true)}
                >
                  <AlertTriangle size={14} />
                  Report blocked
                </Button>
                <MarkComplete task={task} onChanged={onChanged} />
              </div>
            )}
          </div>
        </div>
      </article>

      <ProgressUpdateSheet
        open={updating}
        task={task}
        onClose={() => setUpdating(false)}
        onSaved={onChanged}
      />
      <BlockedSheet open={blocking} task={task} onClose={() => setBlocking(false)} onChanged={onChanged} />
    </>
  )
}

function Figure({ label, value, icon: Icon, tone }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-micro font-medium uppercase tracking-[0.05em] text-subtle">
        {Icon && <Icon size={11} />}
        {label}
      </dt>
      <dd className={cn('mt-1 font-display text-[1.0625rem] font-semibold tabular text-ink', tone)}>{value}</dd>
    </div>
  )
}

function MarkComplete({ task, onChanged }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const complete = async () => {
    setSaving(true)
    try {
      await api.site.updateTask(task.id, { status: 'completed', progress: 100 })
      toast.success('Task marked complete', task.title)
      onChanged?.()
    } catch (err) {
      toast.error('Could not mark it complete', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button variant="secondary" className="flex-1" loading={saving} onClick={complete}>
      <Check size={14} />
      Mark done
    </Button>
  )
}

/** Flagging a task as stopped. This is the one that wakes the project manager. */
function BlockedSheet({ open, task, onClose, onChanged }) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 3) return
    setSaving(true)
    try {
      await api.site.updateTask(task.id, { blocked_reason: reason.trim() })
      toast.success('Reported as blocked', 'The project manager has been notified')
      setReason('')
      onClose?.()
      onChanged?.()
    } catch (err) {
      toast.error('Could not report it', err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Report blocked"
      description={task?.title}
      footer={
        <Button variant="accent" size="lg" className="w-full" loading={saving} onClick={submit}>
          Report blocked
        </Button>
      }
    >
      <p className="mb-3 text-base leading-relaxed text-muted">
        What is stopping the work? This goes to the project manager straight away.
      </p>
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={4}
        autoFocus
        placeholder="Waiting on the structural drawing revision before the columns can be set out."
        className="text-base"
      />
    </Sheet>
  )
}
