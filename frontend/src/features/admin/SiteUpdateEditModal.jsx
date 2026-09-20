import { useEffect, useState } from 'react'

import { siteUpdateService } from '@/services'
import { useToast } from '@/lib/toast'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

/**
 * Correct a filed site report.
 *
 * Only the observations can be changed. The project, the date and who filed it
 * are what make the report an account of a particular day on a particular
 * site, so the API keeps them fixed and this form does not offer them.
 */
export function SiteUpdateEditModal({ open, onClose, onSaved, update }) {
  const toast = useToast()
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (!open || !update) return
    setErrors({})
    setForm({
      work_completed: update.work_completed || '',
      progress_percent: String(update.progress_percent ?? 0),
      workers_count: String(update.workers_count ?? 0),
      issues: update.issues || '',
      weather: update.weather || '',
    })
  }, [open, update])

  if (!update) return null

  const set = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async () => {
    const found = {}
    if (form.work_completed.trim().length < 3) {
      found.work_completed = 'Describe what was completed.'
    }
    const progress = Number(form.progress_percent)
    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      found.progress_percent = 'Enter a percentage between 0 and 100.'
    }
    const workers = Number(form.workers_count)
    if (Number.isNaN(workers) || workers < 0) found.workers_count = 'Enter a headcount of 0 or more.'
    setErrors(found)
    if (Object.keys(found).length) return

    setSaving(true)
    try {
      await siteUpdateService.update(update.id, {
        work_completed: form.work_completed.trim(),
        progress_percent: progress,
        workers_count: workers,
        issues: form.issues,
        weather: form.weather,
      })
      toast.success('Site report corrected.')
      onSaved?.()
      onClose()
    } catch (error) {
      toast.error(error.status === 403 ? 'Your role cannot edit site reports.' : error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Correct site report"
      description={`${update.project_name} · ${formatDate(update.date)} · filed by ${update.reported_by_name || 'unknown'}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            Save correction
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Work completed" required error={errors.work_completed}>
          <Textarea rows={4} value={form.work_completed} onChange={set('work_completed')} />
        </Field>

        <FieldRow>
          <Field label="Progress reported" required error={errors.progress_percent} hint="Percent complete for the project on this date.">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.progress_percent}
              onChange={set('progress_percent')}
            />
          </Field>
          <Field label="Workers on site" error={errors.workers_count}>
            <Input type="number" min="0" value={form.workers_count} onChange={set('workers_count')} />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Weather">
            <Input value={form.weather} onChange={set('weather')} placeholder="Clear" />
          </Field>
          <Field label="Issues raised" hint="Leave empty if the day was clean.">
            <Input value={form.issues} onChange={set('issues')} />
          </Field>
        </FieldRow>

        <p className="text-tiny leading-relaxed text-subtle">
          The correction is recorded in the activity log with your name against it. The
          original author, date and project stay as filed.
        </p>
      </div>
    </Modal>
  )
}
