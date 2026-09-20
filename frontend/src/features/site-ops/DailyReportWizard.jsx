import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, ClipboardList,
  CloudSun, Package, Plus, Send, Users, X,
} from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { SuccessBurst } from './SuccessBurst'
import { PhotoPicker } from './PhotoPicker'
import { ChipGroup, FieldBlock, ProgressSlider, SEVERITY_OPTIONS, Stepper } from './controls'
import { useSite } from './SiteContext'

const DRAFT_KEY = 'buildsync-site-report-draft'
const WEATHER = ['Clear', 'Hazy', 'Overcast', 'Light rain', 'Heavy rain', 'Hot and dry']

const STEPS = [
  { key: 'project', title: 'Project', icon: ClipboardList },
  { key: 'work', title: 'Work completed', icon: Check },
  { key: 'progress', title: 'Progress', icon: ArrowRight },
  { key: 'workers', title: 'Workers', icon: Users },
  { key: 'materials', title: 'Materials', icon: Package },
  { key: 'issues', title: 'Issues', icon: AlertTriangle },
  { key: 'photos', title: 'Photos', icon: Camera },
  { key: 'submit', title: 'Submit', icon: Send },
]

const emptyDraft = () => ({
  date: new Date().toISOString().slice(0, 10),
  weather: 'Clear',
  work_completed: '',
  progress_percent: 0,
  workers_present: 0,
  workers_absent: 0,
  crews: [],
  materials_used: [],
  issues: '',
  issue_severity: 'medium',
  notes: '',
})

/**
 * The end-of-day report, one question at a time.
 *
 * A single long form is the wrong shape for this: it is filled in standing
 * up, at the end of a shift, and anything that looks like eight fields at
 * once gets abandoned. One question per screen means the person can stop,
 * answer a radio call, and come back — so the draft is written to the device
 * on every change and restored when they reopen it.
 *
 * Only two of the eight steps can block progress (the project and the work
 * description). The rest can be skipped, because a partial report filed today
 * is worth more than a complete one filed never.
 */
export function DailyReportWizard({ open, onClose, onSubmitted }) {
  const { projectId, project, projects, selectProject, reload } = useSite()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(emptyDraft)
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: materials } = useAsync(
    () => (open && projectId ? api.site.materials(projectId) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )
  const { data: workforce } = useAsync(
    () => (open && projectId ? api.site.workforce(projectId) : Promise.resolve(null)),
    [open, projectId],
    { immediate: open },
  )

  // Restore whatever was being written when the app was last closed.
  useEffect(() => {
    if (!open) return
    setStep(0)
    setError(null)
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null')
      // A draft from a previous day describes work nobody remembers; start clean.
      setDraft(stored?.date === new Date().toISOString().slice(0, 10) ? { ...emptyDraft(), ...stored } : emptyDraft())
    } catch {
      setDraft(emptyDraft())
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      /* private browsing: the draft lives for this session only */
    }
  }, [draft, open])

  // Headcount already recorded today should not be asked for twice.
  useEffect(() => {
    if (!open || !workforce?.today) return
    setDraft((current) =>
      current.workers_present || current.crews.length
        ? current
        : {
            ...current,
            workers_present: workforce.today.present || 0,
            workers_absent: workforce.today.absent || 0,
            crews: workforce.today.crews || [],
          },
    )
  }, [open, workforce])

  useEffect(() => {
    if (!open || !project) return
    setDraft((current) =>
      current.progress_percent ? current : { ...current, progress_percent: Math.round(project.actual_progress || 0) },
    )
  }, [open, project])

  const set = useCallback((patch) => setDraft((current) => ({ ...current, ...patch })), [])

  const blocked = useMemo(() => {
    if (STEPS[step].key === 'project') return projectId ? null : 'Choose which site this report is for.'
    if (STEPS[step].key === 'work' && draft.work_completed.trim().length < 3) {
      return 'Describe what was built today — one line is enough.'
    }
    return null
  }, [step, projectId, draft.work_completed])

  const next = () => {
    if (blocked) return setError(blocked)
    setError(null)
    setStep((current) => Math.min(STEPS.length - 1, current + 1))
    return undefined
  }

  const back = () => {
    setError(null)
    setStep((current) => Math.max(0, current - 1))
  }

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      await api.site.submitReport({
        project_id: projectId,
        date: draft.date,
        work_completed: draft.work_completed.trim(),
        progress_percent: Number(draft.progress_percent),
        workers_present: Number(draft.workers_present) || 0,
        workers_absent: Number(draft.workers_absent) || 0,
        crews: draft.crews,
        materials_used: draft.materials_used
          .filter((row) => row.name && Number(row.quantity) > 0)
          .map((row) => ({ name: row.name, quantity: Number(row.quantity), unit: row.unit || 'units' })),
        issues: draft.issues.trim(),
        issue_severity: draft.issue_severity,
        weather: draft.weather,
        photo_ids: photos.map((p) => p.id),
        notes: draft.notes.trim(),
      })
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        /* nothing to clear */
      }
      setDone(true)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const finish = () => {
    setDone(false)
    setSaving(false)
    setDraft(emptyDraft())
    setPhotos([])
    onClose?.()
    reload()
    onSubmitted?.()
  }

  if (!open && !done) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return createPortal(
    <>
      {!done && (
        <div className="fixed inset-0 z-[85] flex flex-col bg-paper">
          {/* Where you are in the sequence, always visible. */}
          <header className="site-band shrink-0">
            <div className="mx-auto w-full max-w-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-micro uppercase tracking-[0.08em] text-paper/60">
                    Step {step + 1} of {STEPS.length}
                  </p>
                  <h2 className="truncate font-display text-[1.0625rem] font-semibold leading-tight">
                    {current.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close without submitting"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-paper/80 active:bg-paper/10"
                >
                  <X size={22} />
                </button>
              </div>

              <ol className="mt-3 flex gap-1" aria-label="Report steps">
                {STEPS.map((item, index) => (
                  <li key={item.key} className="flex-1">
                    <button
                      type="button"
                      onClick={() => index < step && setStep(index)}
                      disabled={index > step}
                      aria-label={`Step ${index + 1}: ${item.title}`}
                      aria-current={index === step ? 'step' : undefined}
                      className={cn(
                        'h-1.5 w-full rounded-pill transition-colors duration-300',
                        index < step ? 'bg-amber' : index === step ? 'bg-paper' : 'bg-paper/25',
                      )}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-2xl px-4 py-6">
              <StepBody
                step={current.key}
                draft={draft}
                set={set}
                project={project}
                projects={projects}
                projectId={projectId}
                selectProject={selectProject}
                materials={materials || []}
                photos={photos}
                setPhotos={setPhotos}
              />

              {error && (
                <p
                  role="alert"
                  className="mt-5 rounded-control border border-critical/25 bg-critical-wash px-3.5 py-3 text-base text-critical"
                >
                  {error}
                </p>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-line bg-surface px-4 py-3 pb-safe">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2.5">
              <Button
                variant="secondary"
                size="lg"
                onClick={back}
                disabled={step === 0}
                className="w-[104px] shrink-0"
              >
                <ArrowLeft size={17} />
                Back
              </Button>
              {isLast ? (
                <Button variant="accent" size="lg" className="flex-1" loading={saving} onClick={submit}>
                  <Send size={17} />
                  Submit report
                </Button>
              ) : (
                <Button variant="primary" size="lg" className="flex-1" onClick={next}>
                  Continue
                  <ArrowRight size={17} />
                </Button>
              )}
            </div>
          </footer>
        </div>
      )}

      <SuccessBurst
        open={done}
        title="Daily site report submitted"
        detail="The project manager has been notified."
        duration={2100}
        onDone={finish}
      />
    </>,
    document.body,
  )
}

function StepBody({ step, draft, set, project, projects, projectId, selectProject, materials, photos, setPhotos }) {
  if (step === 'project') {
    return (
      <div className="space-y-5">
        <Intro title="Which site, and when" text="Everything else in this report is filed against this." />
        <FieldBlock label="Site" required>
          <div className="space-y-2">
            {projects.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => selectProject(option.id)}
                className={cn(
                  'tap flex w-full items-center justify-between gap-3 rounded-control border px-3.5 text-left',
                  option.id === projectId ? 'border-ink bg-raised' : 'border-line',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-ink">{option.name}</span>
                  <span className="block truncate text-tiny text-subtle">{option.location || option.code}</span>
                </span>
                {option.id === projectId && <Check size={18} className="shrink-0 text-healthy" />}
              </button>
            ))}
          </div>
        </FieldBlock>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBlock label="Date">
            <Input
              type="date"
              value={draft.date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => set({ date: event.target.value })}
              className="h-12 text-base"
            />
          </FieldBlock>
          <FieldBlock label="Weather">
            <Select
              value={draft.weather}
              onChange={(event) => set({ weather: event.target.value })}
              className="h-12"
            >
              {WEATHER.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </FieldBlock>
        </div>
      </div>
    )
  }

  if (step === 'work') {
    return (
      <div className="space-y-5">
        <Intro title="What got built today" text="Plain language. This is what the project manager reads first." />
        <Textarea
          value={draft.work_completed}
          onChange={(event) => set({ work_completed: event.target.value })}
          rows={7}
          autoFocus
          placeholder="Slab concreting completed on the eighth floor — 62 cum of M30 poured, cube samples taken. Shuttering struck on level six."
          className="text-body"
        />
      </div>
    )
  }

  if (step === 'progress') {
    return (
      <div className="space-y-5">
        <Intro
          title="Where the site stands"
          text={`Overall completion for ${project?.name || 'this site'} at the end of today.`}
        />
        <ProgressSlider
          value={draft.progress_percent}
          previous={project ? Math.round(project.actual_progress || 0) : null}
          onChange={(value) => set({ progress_percent: value })}
          label="Completion"
        />
      </div>
    )
  }

  if (step === 'workers') {
    const total = (Number(draft.workers_present) || 0) + (Number(draft.workers_absent) || 0)
    return (
      <div className="space-y-5">
        <Intro title="Who was on site" text="The headcount at the gate, not the payroll." />
        <FieldBlock label="Present">
          <Stepper
            value={draft.workers_present}
            onChange={(value) => set({ workers_present: value })}
            step={1}
            max={5000}
            label="present"
            suffix="people"
          />
        </FieldBlock>
        <FieldBlock label="Absent">
          <Stepper
            value={draft.workers_absent}
            onChange={(value) => set({ workers_absent: value })}
            step={1}
            max={5000}
            label="absent"
            suffix="people"
          />
        </FieldBlock>
        {total > 0 && (
          <p className="rounded-control border border-line bg-raised px-3.5 py-3 text-base text-muted">
            <span className="font-display text-h4 font-semibold tabular text-ink">{total}</span> on the books ·{' '}
            <span className="tabular text-healthy">{draft.workers_present} present</span>
            {Number(draft.workers_absent) > 0 && (
              <>
                {' · '}
                <span className="tabular text-critical">{draft.workers_absent} absent</span>
              </>
            )}
          </p>
        )}
      </div>
    )
  }

  if (step === 'materials') {
    const rows = draft.materials_used
    return (
      <div className="space-y-5">
        <Intro
          title="What went into the work"
          text="These quantities come off site stock, which is what drives the reorder dates."
        />
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Select
                value={row.name}
                className="h-12 flex-1"
                onChange={(event) => {
                  const material = materials.find((m) => m.name === event.target.value)
                  set({
                    materials_used: rows.map((item, i) =>
                      i === index ? { ...item, name: event.target.value, unit: material?.unit || 'units' } : item,
                    ),
                  })
                }}
              >
                <option value="">Choose a material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.name}>
                    {material.name} ({formatNumber(material.available_qty, 1)} {material.unit} on site)
                  </option>
                ))}
              </Select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={row.quantity}
                placeholder="Qty"
                onChange={(event) =>
                  set({
                    materials_used: rows.map((item, i) =>
                      i === index ? { ...item, quantity: event.target.value } : item,
                    ),
                  })
                }
                className="input h-12 w-24 text-center tabular"
              />
              <button
                type="button"
                onClick={() => set({ materials_used: rows.filter((_, i) => i !== index) })}
                aria-label="Remove material"
                className="flex h-12 w-11 shrink-0 items-center justify-center rounded-control text-subtle active:bg-raised"
              >
                <X size={18} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ materials_used: [...rows, { name: '', quantity: '', unit: 'units' }] })}
            className="tap flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong text-base font-medium text-muted active:bg-raised"
          >
            <Plus size={16} />
            Add a material
          </button>
        </div>
      </div>
    )
  }

  if (step === 'issues') {
    return (
      <div className="space-y-5">
        <Intro
          title="Anything holding the work up"
          text="Leave it blank if the day ran clean. Anything written here is raised as a tracked issue, not buried in the report."
        />
        <FieldBlock label="How bad is it">
          <ChipGroup
            options={SEVERITY_OPTIONS}
            value={draft.issue_severity}
            onChange={(value) => set({ issue_severity: value })}
            columns={4}
          />
        </FieldBlock>
        <Textarea
          value={draft.issues}
          onChange={(event) => set({ issues: event.target.value })}
          rows={5}
          placeholder="Steel delivery slipped by two days; supplier has confirmed a revised despatch for Thursday."
          className="text-body"
        />
      </div>
    )
  }

  if (step === 'photos') {
    return (
      <div className="space-y-5">
        <Intro title="Photographs from today" text="Evidence of the work as it stands at the end of the shift." />
        <PhotoPicker
          projectId={projectId}
          value={photos}
          onChange={setPhotos}
          label="Site photos"
          category="other"
          max={10}
        />
        <FieldBlock label="Anything else">
          <Textarea
            value={draft.notes}
            onChange={(event) => set({ notes: event.target.value })}
            rows={3}
            placeholder="Optional notes for the project manager."
            className="text-base"
          />
        </FieldBlock>
      </div>
    )
  }

  // Submit: what is about to be sent, in the order it will be read.
  const usedMaterials = draft.materials_used.filter((row) => row.name && Number(row.quantity) > 0)
  return (
    <div className="space-y-4">
      <Intro title="Check it over" text="This goes to the project manager as soon as you submit." />

      <dl className="divide-y divide-line rounded-panel border border-line">
        <Summary label="Site" value={project?.name} icon={ClipboardList} />
        <Summary
          label="Date"
          value={`${new Date(draft.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${draft.weather}`}
          icon={CloudSun}
        />
        <Summary label="Work completed" value={draft.work_completed} icon={Check} />
        <Summary label="Progress" value={`${Math.round(draft.progress_percent)}% complete`} icon={ArrowRight} />
        <Summary
          label="Workers"
          value={`${draft.workers_present} present · ${draft.workers_absent} absent`}
          icon={Users}
        />
        <Summary
          label="Materials"
          value={
            usedMaterials.length
              ? usedMaterials.map((row) => `${row.name} ${row.quantity} ${row.unit}`).join(', ')
              : 'None recorded'
          }
          icon={Package}
        />
        <Summary
          label="Issues"
          value={draft.issues.trim() || 'None — the day ran clean'}
          icon={AlertTriangle}
          tone={draft.issues.trim() ? 'text-amber-deep' : undefined}
        />
        <Summary
          label="Photos"
          value={photos.length ? `${photos.length} attached` : 'None attached'}
          icon={Camera}
        />
      </dl>
    </div>
  )
}

function Intro({ title, text }) {
  return (
    <div>
      <h3 className="font-display text-h3 text-ink">{title}</h3>
      <p className="mt-1.5 text-body leading-relaxed text-muted">{text}</p>
    </div>
  )
}

function Summary({ label, value, icon: Icon, tone }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <Icon size={15} className="mt-0.5 shrink-0 text-subtle" />
      <div className="min-w-0 flex-1">
        <dt className="text-micro font-medium uppercase tracking-[0.05em] text-subtle">{label}</dt>
        <dd className={cn('mt-0.5 text-base leading-relaxed text-ink', tone)}>{value || '—'}</dd>
      </div>
    </div>
  )
}
