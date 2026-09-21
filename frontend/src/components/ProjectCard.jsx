import { Link } from 'react-router-dom'
import { CalendarDays, MapPin } from 'lucide-react'

import { cn } from '@/lib/cn'
import { daysUntil, formatDate, formatINR, formatPercent } from '@/lib/format'
import { toneForVariance } from '@/lib/tone'
import { useAuth } from '@/lib/auth'
import { projectPath } from '@/lib/workspaces'
import { Panel } from './ui/Panel'
import { ProgressBar } from './ui/ProgressBar'
import { StatusBadge } from './ui/StatusBadge'
import { AvatarStack } from './ui/Avatar'

export function ProjectCard({ project, delay = 0 }) {
  const { home } = useAuth()
  const schedule = project.metrics?.schedule
  const budget = project.metrics?.budget
  const variance = schedule?.variance ?? 0
  const tone = toneForVariance(variance)
  const remaining = daysUntil(project.end_date)

  return (
    <Panel interactive className={cn('rule-left group', tone.rule)}>
      <Link to={projectPath(home, project.id)} className="block p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-tiny text-muted">
              <span className="font-medium">{project.code}</span>
              <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden />
              <span className="truncate">{project.category}</span>
            </div>
            <h3 className="mt-1 truncate font-display text-h4 text-ink">{project.name}</h3>
          </div>
          <StatusBadge status={project.status} pulse={project.status === 'at_risk'} />
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-h3 tabular text-ink">
              {formatPercent(schedule?.actual_progress ?? project.actual_progress)}
            </span>
            <span className={cn('text-tiny font-medium tabular', tone.text)}>
              {variance > 0 ? '+' : ''}{variance.toFixed(1)} pts vs plan
            </span>
          </div>
          <ProgressBar
            value={schedule?.actual_progress ?? project.actual_progress ?? 0}
            planned={schedule?.planned_progress}
            tone={tone.bar}
            delay={delay}
            className="mt-2"
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
          <Cell label="Budget" value={formatINR(project.budget)} />
          <Cell
            label="Committed"
            value={budget ? `${formatINR(budget.spent)} · ${formatPercent(budget.burn_percent)}` : '—'}
          />
          <Cell
            label="Deadline"
            value={formatDate(project.end_date)}
            hint={remaining !== null ? (remaining < 0 ? `${Math.abs(remaining)} days over` : `${remaining} days left`) : null}
            hintTone={remaining !== null && remaining < 45 ? 'text-critical' : 'text-subtle'}
            icon={CalendarDays}
          />
          <Cell label="Location" value={project.location || '—'} icon={MapPin} />
        </dl>

        <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
          <span className="truncate text-tiny text-muted">{project.manager_name}</span>
          <AvatarStack people={project.team || []} max={3} />
        </div>
      </Link>
    </Panel>
  )
}

function Cell({ label, value, hint, hintTone, icon: Icon }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-micro text-subtle">
        {Icon && <Icon size={11} strokeWidth={2} />}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-base tabular text-ink">{value}</dd>
      {hint && <dd className={cn('text-micro tabular', hintTone)}>{hint}</dd>}
    </div>
  )
}
