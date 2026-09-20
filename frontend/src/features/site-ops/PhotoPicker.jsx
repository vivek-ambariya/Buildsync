import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, Loader2, X } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useSite } from './SiteContext'

/**
 * Photographs attached to something being reported.
 *
 * Two entry points, because they are two different acts: **Take photo** opens
 * the rear camera directly (the phone is already pointing at the work), and
 * **Choose** opens the library for shots taken earlier in the shift.
 *
 * Files upload the moment they are picked rather than when the form is
 * submitted. A site manager photographs the work, then writes the note — so
 * by the time they finish the sentence the images are already on the server,
 * and pressing submit is instant instead of a two-minute wait on a bar of
 * signal. The trade is orphaned photos if the form is abandoned; they stay
 * attached to the project and appear in the gallery, which is where the
 * person would have put them anyway.
 */
export function PhotoPicker({
  projectId,
  taskId,
  category = 'other',
  description = '',
  value = [],
  onChange,
  label = 'Photos',
  max = 8,
}) {
  const { projectId: contextProjectId } = useSite()
  const project = projectId || contextProjectId
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [previews, setPreviews] = useState([])

  // Object URLs are a browser resource, not React state; release them.
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const upload = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).slice(0, max - value.length)
      if (!files.length) return
      if (!project) {
        setError('Choose a site first.')
        return
      }

      const local = files.map((file) => ({ key: `${file.name}-${file.lastModified}`, url: URL.createObjectURL(file) }))
      setPreviews((current) => [...current, ...local])
      setError(null)
      setUploading(true)
      setProgress(0)

      const body = new FormData()
      files.forEach((file) => body.append('files', file))
      body.append('project_id', project)
      body.append('category', category)
      if (taskId) body.append('task_id', taskId)
      if (description.trim()) body.append('description', description.trim())

      try {
        const saved = await api.site.uploadPhotos(body, setProgress)
        onChange?.([...value, ...saved])
      } catch (err) {
        setError(err.message)
        setPreviews((current) => current.filter((p) => !local.some((l) => l.key === p.key)))
        local.forEach((p) => URL.revokeObjectURL(p.url))
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [project, category, taskId, description, value, onChange, max],
  )

  const removePhoto = async (photo) => {
    onChange?.(value.filter((p) => p.id !== photo.id))
    try {
      await api.site.removePhoto(photo.id)
    } catch {
      /* the attachment is already gone from this report; the file can wait */
    }
  }

  const full = value.length >= max

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-tiny font-semibold uppercase tracking-[0.05em] text-muted">{label}</span>
        <span className="text-micro tabular text-subtle">
          {value.length} / {max}
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={uploading || full}
          className="tap flex flex-1 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-base font-medium text-ink transition-colors active:bg-raised disabled:opacity-45"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
          Take photo
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          disabled={uploading || full}
          className="tap flex flex-1 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-base font-medium text-muted transition-colors active:bg-raised disabled:opacity-45"
        >
          <ImagePlus size={18} />
          Choose
        </button>
      </div>

      {/* `capture` asks the phone for the rear camera; a desktop browser
          ignores it and opens a file picker, which is the right fallback. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          upload(event.target.files)
          event.target.value = ''
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => {
          upload(event.target.files)
          event.target.value = ''
        }}
      />

      {uploading && (
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-line">
            <div
              className="h-full rounded-pill bg-amber transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-micro tabular text-subtle">Uploading… {progress}%</p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-control border border-critical/25 bg-critical-wash px-3 py-2 text-tiny text-critical">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {value.map((photo) => (
            <li key={photo.id} className="relative">
              <img
                src={api.site.photoUrl(photo.id)}
                alt={photo.name || 'Site photo'}
                loading="lazy"
                className="aspect-square w-full rounded-control border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(photo)}
                aria-label={`Remove ${photo.name || 'photo'}`}
                className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-muted shadow-popover active:bg-raised"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** A full-screen look at one photograph, for a gallery or an issue thread. */
export function PhotoLightbox({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [photo, onClose])

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[85] flex flex-col bg-ink/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3.5 text-paper">
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{photo.description || photo.name}</p>
          <p className="text-micro text-paper/60">
            {photo.uploaded_by_name} · {new Date(photo.taken_at || photo.created_at).toLocaleString('en-IN')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-paper/80 active:bg-paper/10"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-hidden px-3 pb-6">
        <img
          src={api.site.photoUrl(photo.id)}
          alt={photo.description || photo.name || 'Site photo'}
          className={cn('max-h-full max-w-full rounded-panel object-contain')}
        />
      </div>
    </div>
  )
}
