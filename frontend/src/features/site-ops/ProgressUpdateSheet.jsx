import { useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { formatNumber } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { SuccessBurst } from './SuccessBurst'
import { PhotoPicker } from './PhotoPicker'
import { FieldBlock, ProgressSlider, Stepper } from './controls'
import { useSite } from './SiteContext'

/**
 * The update the whole site app exists for.
 *
 * Ordered by what the person already knows without looking anything up: they
 * know which task, they know how far it got, and they can describe it. Only
 * then does it ask for headcount and consumption, which are counts rather
 * than recollections. Everything below the description is optional, so the
 * minimum viable update is three taps and a sentence.
 */
export function ProgressUpdateSheet({ open, onClose, task, onSaved }) {
  const { projectId, project, reload } = useSite()
  const [taskId, setTaskId] = useState(task?.id || '')
  const [progress, setProgress] = useState(0)
  const [workCompleted, setWorkCompleted] = useState('')
  const [workers, setWorkers] = useState(0)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState([])
  const [usage, setUsage] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: tasks } = useAsync(
    () => (open && projectId ? api.site.tasks({ project_id: projectId }) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )
  const { data: materials } = useAsync(
    () => (open && projectId ? api.site.materials(projectId) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )

  const selected = useMemo(
    () => (task?.id === taskId ? task : (tasks || []).find((t) => t.id === taskId)),
    [task, taskId, tasks],
  )
  const previous = selected ? Number(selected.progress || 0) : null

  // Opening on a task starts from where that task actually is, so the slider
  // measures today's work rather than being dragged back to a known figure.
  useEffect(() => {
    if (!open) return
    const initial = task || null
    setTaskId(initial?.id || '')
    setProgress(Number(initial?.progress || 0))
    setWorkCompleted('')
    setWorkers(0)
    setNotes('')
    setPhotos([])
    setUsage([])
    setError(null)
  }, [open, task])

  useEffect(() => {
    if (selected) setProgress(Number(selected.progress || 0))
  }, [selected])

  const submit = async (event) => {
    event?.preventDefault?.()
    setError(null)
    if (workCompleted.trim().length < 3) {
      setError('Say what was completed — one line is enough.')
      return
    }
    setSaving(true)
    try {
      await api.site.recordProgress({
        project_id: projectId,
        task_id: taskId || null,
        new_progress: Number(progress),
        work_completed: workCompleted.trim(),
        workers_used: Number(workers) || 0,
        materials_used: usage
          .filter((row) => row.name && Number(row.quantity) > 0)
          .map((row) => ({ name: row.name, quantity: Number(row.quantity), unit: row.unit || 'units' })),
        notes: notes.trim(),
        photo_ids: photos.map((p) => p.id),
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const finish = () => {
    setDone(false)
    onClose?.()
    reload()
    onSaved?.()
  }

  return (
    <>
      <Sheet
        open={open && !done}
        onClose={onClose}
        title="Update progress"
        description={project?.name}
        footer={
          <Button variant="accent" size="lg" className="w-full" loading={saving} onClick={submit}>
            Submit update
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <FieldBlock label="Task">
            {task ? (
              <div className="rounded-control border border-line bg-raised px-3.5 py-3">
                <p className="text-base font-medium text-ink">{task.title}</p>
                <p className="mt-0.5 text-tiny text-subtle">{task.phase}</p>
              </div>
            ) : (
              <Select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-12">
                <option value="">General site progress</option>
                {(tasks || []).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} — {Math.round(option.progress || 0)}%
                  </option>
                ))}
              </Select>
            )}
          </FieldBlock>

          <ProgressSlider value={progress} previous={previous} onChange={setProgress} label="New progress" />

          <FieldBlock label="Work completed" required>
            <Textarea
              value={workCompleted}
              onChange={(event) => setWorkCompleted(event.target.value)}
              rows={3}
              placeholder="Reinforcement tied and inspected on the north footing. Shuttering ready for tomorrow's pour."
              className="text-base"
            />
          </FieldBlock>

          <FieldBlock label="Workers used">
            <Stepper value={workers} onChange={setWorkers} step={1} max={2000} label="workers" suffix="people" />
          </FieldBlock>

          <FieldBlock
            label="Materials used"
            hint="Anything recorded here comes straight off site stock, which is what drives the reorder alerts."
          >
            <div className="space-y-2">
              {usage.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <Select
                    value={row.name}
                    className="h-12 flex-1"
                    onChange={(event) => {
                      const material = (materials || []).find((m) => m.name === event.target.value)
                      setUsage((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, name: event.target.value, unit: material?.unit || 'units' } : item,
                        ),
                      )
                    }}
                  >
                    <option value="">Choose a material</option>
                    {(materials || []).map((material) => (
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
                      setUsage((current) =>
                        current.map((item, i) => (i === index ? { ...item, quantity: event.target.value } : item)),
                      )
                    }
                    className="input h-12 w-24 text-center tabular"
                  />
                  <button
                    type="button"
                    onClick={() => setUsage((current) => current.filter((_, i) => i !== index))}
                    aria-label="Remove material"
                    className="flex h-12 w-11 shrink-0 items-center justify-center rounded-control text-subtle active:bg-raised"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setUsage((current) => [...current, { name: '', quantity: '', unit: 'units' }])}
                className="tap flex w-full items-center justify-center gap-2 rounded-control border border-dashed border-line-strong text-base font-medium text-muted active:bg-raised"
              >
                <Plus size={16} />
                Add a material
              </button>
            </div>
          </FieldBlock>

          <PhotoPicker projectId={projectId} taskId={taskId || undefined} value={photos} onChange={setPhotos} />

          <FieldBlock label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              placeholder="Anything the project manager should know."
              className="text-base"
            />
          </FieldBlock>

          {error && (
            <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
              {error}
            </p>
          )}
        </form>
      </Sheet>

      <SuccessBurst
        open={done}
        title="Progress updated"
        detail={
          selected
            ? `${selected.title} is now ${Math.round(progress)}% complete.`
            : 'The site record has been updated.'
        }
        onDone={finish}
      />
    </>
  )
}
