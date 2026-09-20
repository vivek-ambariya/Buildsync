import { useMemo, useState } from 'react'
import { AlertTriangle, CloudSun, Hammer, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { formatDate, formatNumber, formatPercent, relativeTime } from '@/lib/format'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { Panel } from '@/components/ui/Panel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

/**
 * The daily record from site. Each entry answers the same four questions a
 * project manager asks on a morning call: how far, how many people, what got
 * used, and what went wrong.
 */
export function SiteUpdateFeed({ projectId, projects, showProject = true }) {
  const { can } = useAuth()
  const { data, error, loading, reload } = useAsync(
    () => api.siteUpdates.list(projectId ? { project_id: projectId, limit: 60 } : { limit: 60 }),
    [projectId],
  )
  const [filing, setFiling] = useState(false)
  const [onlyIssues, setOnlyIssues] = useState(false)

  const grouped = useMemo(() => {
    let rows = data || []
    if (onlyIssues) rows = rows.filter((update) => (update.issues || '').trim())
    return rows.reduce((out, update) => {
      const key = formatDate(update.date)
      out[key] = out[key] || []
      out[key].push(update)
      return out
    }, {})
  }, [data, onlyIssues])

  const stats = useMemo(() => {
    const rows = data || []
    const recent = rows.slice(0, 7)
    return {
      reports: rows.length,
      issues: rows.filter((update) => (update.issues || '').trim()).length,
      workers: recent.length
        ? Math.round(recent.reduce((sum, update) => sum + (update.workers_count || 0), 0) / recent.length)
        : 0,
    }
  }, [data])

  if (error) return <ErrorState title="We could not load the site reports" description={error.message} onRetry={reload} />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <p className="text-tiny text-muted">
          <span className="tabular text-ink">{stats.reports}</span> reports ·{' '}
          <span className="tabular text-ink">{stats.workers}</span> average daily headcount
          {stats.issues > 0 && (
            <>
              {' · '}
              <span className="tabular text-amber-deep">{stats.issues} with issues</span>
            </>
          )}
        </p>
        <label className="flex cursor-pointer select-none items-center gap-2 text-base text-muted">
          <input
            type="checkbox"
            checked={onlyIssues}
            onChange={(event) => setOnlyIssues(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-line-strong accent-ink"
          />
          Only reports with issues
        </label>
        {can('fileSiteUpdates') && (
          <Button variant="primary" className="ml-auto" onClick={() => setFiling(true)}>
            <Plus size={15} />
            File a report
          </Button>
        )}
      </div>

      {loading && !data ? (
        <PanelSkeleton rows={6} />
      ) : Object.keys(grouped).length === 0 ? (
        <Panel>
          <EmptyState
            icon={Hammer}
            title={onlyIssues ? 'No issues reported' : 'No site reports yet'}
            description={
              onlyIssues
                ? 'Nothing has been flagged from site in this period.'
                : 'File a daily report from site and the progress curve, headcount and stock consumption all update from it.'
            }
            action={
              can('fileSiteUpdates') && !onlyIssues ? (
                <Button variant="primary" onClick={() => setFiling(true)}>
                  <Plus size={15} />
                  File the first report
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, updates]) => (
            <section key={day}>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="panel-title">{day}</h3>
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-micro text-subtle">
                  {updates.length} {updates.length === 1 ? 'report' : 'reports'}
                </span>
              </div>
              <div className="space-y-3">
                {updates.map((update) => (
                  <UpdateCard key={update.id} update={update} showProject={showProject} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SiteUpdateModal
        open={filing}
        projects={projects}
        defaultProjectId={projectId}
        onClose={() => setFiling(false)}
        onSaved={() => {
          setFiling(false)
          reload()
        }}
      />
    </div>
  )
}

function UpdateCard({ update, showProject }) {
  const hasIssue = Boolean((update.issues || '').trim())
  return (
    <Panel interactive className={cn(hasIssue && 'rule-left text-amber')}>
      <div className={cn('p-4', hasIssue && 'pl-5')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={update.reported_by_name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-base text-ink">
                <span className="font-medium">{update.reported_by_name}</span>
                {showProject && update.project_name && (
                  <>
                    {' on '}
                    <Link
                      to={`/app/projects/${update.project_id}`}
                      className="underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink"
                    >
                      {update.project_name}
                    </Link>
                  </>
                )}
              </p>
              <p className="text-micro text-subtle">{relativeTime(update.created_at || update.date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-tiny text-muted">
            <span className="flex items-center gap-1.5">
              <Users size={12} />
              <span className="tabular text-ink">{formatNumber(update.workers_count)}</span> on site
            </span>
            <span className="flex items-center gap-1.5">
              <CloudSun size={12} />
              {update.weather}
            </span>
          </div>
        </div>

        <p className="mt-3 text-body leading-relaxed text-ink">{update.work_completed}</p>

        <div className="mt-3.5 flex items-center gap-3">
          <ProgressBar value={update.progress_percent} tone="ink" showPlannedMarker={false} className="flex-1" />
          <span className="shrink-0 text-tiny tabular text-ink">{formatPercent(update.progress_percent, 1)} complete</span>
        </div>

        {update.materials_used?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {update.materials_used.map((usage, index) => (
              <li
                key={`${usage.name}-${index}`}
                className="rounded-pill border border-line bg-raised px-2.5 py-0.5 text-micro text-muted"
              >
                {usage.name} · {formatNumber(usage.quantity, 1)} {usage.unit}
              </li>
            ))}
          </ul>
        )}

        {hasIssue && (
          <p className="mt-3 flex items-start gap-2 rounded-control bg-amber-wash/60 px-3 py-2.5 text-tiny leading-relaxed text-amber-deep">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {update.issues}
          </p>
        )}
      </div>
    </Panel>
  )
}

const WEATHER = ['Clear', 'Hazy', 'Overcast', 'Light rain', 'Heavy rain', 'Hot and dry']

function SiteUpdateModal({ open, onClose, onSaved, projects, defaultProjectId }) {
  const toast = useToast()
  const [form, setForm] = useState({
    project_id: defaultProjectId || '',
    date: new Date().toISOString().slice(0, 10),
    work_completed: '',
    progress_percent: 0,
    workers_count: 40,
    issues: '',
    weather: 'Clear',
  })
  const [usage, setUsage] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const { data: materials } = useAsync(
    () => (form.project_id ? api.materials.list({ project_id: form.project_id }) : Promise.resolve([])),
    [form.project_id, open],
    { immediate: open },
  )

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (!form.project_id) {
      setError('Choose which project this report is for.')
      return
    }
    setSaving(true)
    try {
      await api.siteUpdates.create({
        ...form,
        progress_percent: Number(form.progress_percent),
        workers_count: Number(form.workers_count),
        materials_used: usage.filter((row) => row.name && Number(row.quantity) > 0).map((row) => ({
          name: row.name,
          quantity: Number(row.quantity),
          unit: row.unit || 'units',
        })),
      })
      toast.success('Report filed', 'Stock and progress have been updated from it')
      setUsage([])
      setForm((current) => ({ ...current, work_completed: '', issues: '' }))
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Daily site report"
      description="What was built today, who was on site, and anything that held the work up."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>File report</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FieldRow>
          <Field label="Project" required>
            <Select value={form.project_id} onChange={set('project_id')} required>
              <option value="">Choose a project</option>
              {(projects || []).map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={set('date')} max={new Date().toISOString().slice(0, 10)} required />
          </Field>
        </FieldRow>

        <Field label="Work completed" required>
          <Textarea
            value={form.work_completed}
            onChange={set('work_completed')}
            rows={3}
            placeholder="Slab concreting completed on the eighth floor, 62 cum poured with M30. Cube samples taken."
            required
            minLength={3}
          />
        </Field>

        <FieldRow className="sm:grid-cols-3">
          <Field label={`Completion — ${form.progress_percent}%`}>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={form.progress_percent}
              onChange={set('progress_percent')}
              className="mt-3 w-full accent-ink"
            />
          </Field>
          <Field label="Workers on site">
            <Input type="number" min="0" max="2000" value={form.workers_count} onChange={set('workers_count')} />
          </Field>
          <Field label="Weather">
            <Select value={form.weather} onChange={set('weather')}>
              {WEATHER.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
        </FieldRow>

        {/* Consumption is drawn straight off site stock, so it is entered here. */}
        <Field
          label="Materials consumed"
          hint="These quantities are deducted from stock on site, which is what drives the reorder alerts."
        >
          <div className="space-y-2">
            {usage.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Select
                  value={row.name}
                  onChange={(event) => {
                    const material = (materials || []).find((m) => m.name === event.target.value)
                    setUsage((current) =>
                      current.map((item, i) =>
                        i === index ? { ...item, name: event.target.value, unit: material?.unit || 'units' } : item,
                      ),
                    )
                  }}
                  className="flex-1"
                >
                  <option value="">Choose a material</option>
                  {(materials || []).map((material) => (
                    <option key={material.id} value={material.name}>
                      {material.name} ({formatNumber(material.available_qty, 1)} {material.unit} on site)
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={row.quantity}
                  onChange={(event) =>
                    setUsage((current) =>
                      current.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)),
                    )
                  }
                  placeholder="Qty"
                  className="w-24"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setUsage((current) => current.filter((_, i) => i !== index))}
                  aria-label="Remove material"
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setUsage((current) => [...current, { name: '', quantity: '', unit: 'units' }])}
              disabled={!form.project_id}
            >
              <Plus size={13} />
              Add a material
            </Button>
          </div>
        </Field>

        <Field label="Issues" hint="Anything logged here notifies the project managers straight away.">
          <Textarea
            value={form.issues}
            onChange={set('issues')}
            rows={2}
            placeholder="Steel delivery slipped by two days; the supplier has confirmed a revised despatch."
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
