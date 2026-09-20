import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { SuccessBurst } from './SuccessBurst'
import { PhotoPicker } from './PhotoPicker'
import { ChipGroup, FieldBlock, SEVERITY_OPTIONS } from './controls'
import { useSite } from './SiteContext'

/**
 * Reporting something that is holding the work up.
 *
 * Severity is chosen first and by tapping one of four, because it decides how
 * loudly the project manager is told and it is the field people are most
 * likely to skip if it is buried at the bottom next to the optional ones.
 */
export function IssueSheet({ open, onClose, task, onSaved }) {
  const { projectId, project, reload } = useSite()
  const [title, setTitle] = useState('')
  const [taskId, setTaskId] = useState(task?.id || '')
  const [severity, setSeverity] = useState('medium')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [expected, setExpected] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: tasks } = useAsync(
    () => (open && projectId ? api.site.tasks({ project_id: projectId }) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )

  useEffect(() => {
    if (!open) return
    setTitle('')
    setTaskId(task?.id || '')
    setSeverity('medium')
    setDescription('')
    setLocation('')
    setExpected('')
    setPhotos([])
    setError(null)
  }, [open, task])

  const submit = async (event) => {
    event?.preventDefault?.()
    setError(null)
    if (title.trim().length < 3) return setError('Give the issue a short title.')
    if (description.trim().length < 3) return setError('Describe what has happened.')

    setSaving(true)
    try {
      await api.site.reportIssue({
        project_id: projectId,
        task_id: taskId || null,
        title: title.trim(),
        severity,
        description: description.trim(),
        location: location.trim(),
        expected_resolution: expected || null,
        photo_ids: photos.map((p) => p.id),
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
    return undefined
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
        title="Report an issue"
        description={project?.name}
        footer={
          <Button variant="accent" size="lg" className="w-full" loading={saving} onClick={submit}>
            Report issue
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-5">
          <FieldBlock label="How bad is it" required>
            <ChipGroup options={SEVERITY_OPTIONS} value={severity} onChange={setSeverity} columns={4} />
          </FieldBlock>

          <FieldBlock label="Issue title" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Material delivery delay"
              className="h-12 text-base"
            />
          </FieldBlock>

          <FieldBlock label="What has happened" required>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Steel delivery has not arrived. Expected today, supplier now saying tomorrow morning."
              className="text-base"
            />
          </FieldBlock>

          <FieldBlock label="Related task">
            <Select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-12">
              <option value="">Not task specific</option>
              {(tasks || []).map((option) => (
                <option key={option.id} value={option.id}>{option.title}</option>
              ))}
            </Select>
          </FieldBlock>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock label="Where on site">
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Block B, level 4"
                className="h-12 text-base"
              />
            </FieldBlock>
            <FieldBlock label="Expected to clear by">
              <Input
                type="date"
                value={expected}
                onChange={(event) => setExpected(event.target.value)}
                className="h-12 text-base"
              />
            </FieldBlock>
          </div>

          <PhotoPicker
            projectId={projectId}
            taskId={taskId || undefined}
            value={photos}
            onChange={setPhotos}
            label="Evidence"
            max={4}
          />

          {error && (
            <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
              {error}
            </p>
          )}
        </form>
      </Sheet>

      <SuccessBurst
        open={done}
        title="Issue reported"
        detail="The project manager has been notified."
        onDone={finish}
      />
    </>
  )
}
