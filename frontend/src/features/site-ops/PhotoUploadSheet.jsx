import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Form'
import { Sheet } from './Sheet'
import { SuccessBurst } from './SuccessBurst'
import { PhotoPicker } from './PhotoPicker'
import { ChipGroup, FieldBlock, PHOTO_CATEGORIES } from './controls'
import { useSite } from './SiteContext'

/**
 * Adding photographs to the site record on their own.
 *
 * The category is chosen *before* the camera opens, not after. Once the phone
 * is back in a pocket nobody returns to classify anything, and an unsorted
 * gallery of four hundred site photos is the same as no gallery at all.
 */
export function PhotoUploadSheet({ open, onClose, onSaved, defaultCategory = 'other' }) {
  const { projectId, project } = useSite()
  const [category, setCategory] = useState(defaultCategory)
  const [taskId, setTaskId] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([])
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const { data: tasks } = useAsync(
    () => (open && projectId ? api.site.tasks({ project_id: projectId }) : Promise.resolve([])),
    [open, projectId],
    { immediate: open },
  )

  useEffect(() => {
    if (!open) return
    setCategory(defaultCategory)
    setTaskId('')
    setDescription('')
    setPhotos([])
    setError(null)
  }, [open, defaultCategory])

  /**
   * Nothing is sent here.
   *
   * The picker uploads each file the moment it is chosen, carrying the
   * category, task and description that were filled in above it — so by the
   * time this button is pressed the photographs are already stored, and the
   * press is a confirmation rather than a transfer. On a site connection that
   * is the difference between an instant close and a minute of waiting with
   * the phone held up.
   */
  const submit = () => {
    if (!photos.length) {
      setError('Take or choose at least one photo.')
      return
    }
    setError(null)
    setDone(true)
  }

  const finish = () => {
    setDone(false)
    onClose?.()
    onSaved?.()
  }

  return (
    <>
      <Sheet
        open={open && !done}
        onClose={onClose}
        title="Upload site photos"
        description={project?.name}
        footer={
          <Button variant="accent" size="lg" className="w-full" onClick={submit}>
            {photos.length ? `Save ${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Save photos'}
          </Button>
        }
      >
        <div className="space-y-5">
          <FieldBlock label="Category" required hint="Pick this first — it is what makes the gallery searchable later.">
            <ChipGroup options={PHOTO_CATEGORIES} value={category} onChange={setCategory} columns={3} />
          </FieldBlock>

          <FieldBlock label="Related task">
            <Select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="h-12">
              <option value="">Not task specific</option>
              {(tasks || []).map((option) => (
                <option key={option.id} value={option.id}>{option.title}</option>
              ))}
            </Select>
          </FieldBlock>

          <FieldBlock label="Description" hint="Written before the camera opens, because nobody comes back to add it.">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="North footing after the pour."
              className="text-base"
            />
          </FieldBlock>

          <PhotoPicker
            projectId={projectId}
            taskId={taskId || undefined}
            category={category}
            description={description}
            value={photos}
            onChange={setPhotos}
            label="Photos"
            max={12}
          />

          {error && (
            <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
              {error}
            </p>
          )}
        </div>
      </Sheet>

      <SuccessBurst
        open={done}
        title="Photos uploaded"
        detail={`${photos.length} photo${photos.length === 1 ? '' : 's'} added to the site record.`}
        onDone={finish}
      />
    </>
  )
}
