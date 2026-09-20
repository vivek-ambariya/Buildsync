import { useMemo, useState } from 'react'
import { Camera, Plus } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { formatDate } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { PhotoLightbox } from '@/features/site-ops/PhotoPicker'
import { PhotoUploadSheet } from '@/features/site-ops/PhotoUploadSheet'
import { FilterStrip, SitePageHeader } from '@/features/site-ops/SitePageHeader'
import { PHOTO_CATEGORIES } from '@/features/site-ops/controls'

/**
 * The photographic record of the site, grouped by the day it was shot.
 *
 * A square grid rather than a list: at a glance a site manager is looking for
 * a moment they remember, and the thumbnail is the index. Tapping opens it
 * full-bleed with who took it and when — the two facts that make a photograph
 * evidence rather than decoration.
 */
export default function SitePhotos() {
  const { projectId, project } = useSite()
  const { can } = useAuth()
  const [category, setCategory] = useState('all')
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState(null)

  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.photos({ project_id: projectId }) : Promise.resolve([])),
    [projectId],
  )
  const scope = useEnter([loading, Boolean(data)])

  const photos = data || []
  const filtered = useMemo(
    () => (category === 'all' ? photos : photos.filter((photo) => photo.category === category)),
    [photos, category],
  )

  const byDay = useMemo(
    () =>
      filtered.reduce((out, photo) => {
        const key = formatDate(photo.taken_at || photo.created_at)
        out[key] = out[key] || []
        out[key].push(photo)
        return out
      }, {}),
    [filtered],
  )

  const counts = useMemo(
    () =>
      photos.reduce((out, photo) => {
        out[photo.category] = (out[photo.category] || 0) + 1
        return out
      }, {}),
    [photos],
  )

  if (error) {
    return <ErrorState title="We could not load the gallery" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Site photos"
        count={photos.length}
        countLabel={`on ${project?.name || 'this site'}`}
        action={
          can('uploadSitePhotos') && (
            <Button variant="accent" onClick={() => setUploading(true)}>
              <Plus size={15} />
              Upload
            </Button>
          )
        }
      >
        <FilterStrip
          className="mt-3.5"
          value={category}
          onChange={setCategory}
          options={[
            { value: 'all', label: 'All', count: photos.length },
            ...PHOTO_CATEGORIES.map((option) => ({ ...option, count: counts[option.value] || 0 })),
          ]}
        />
      </SitePageHeader>

      {loading && !data ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-enter>
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square w-full rounded-control" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={Camera}
            title={category === 'all' ? 'No photos yet' : 'Nothing in this category'}
            description={
              category === 'all'
                ? 'Photograph the work as it goes in. It is the record nobody can argue with later.'
                : 'Try another category, or upload from here.'
            }
            action={
              can('uploadSitePhotos') && (
                <Button variant="accent" onClick={() => setUploading(true)}>
                  <Camera size={15} />
                  Upload photos
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-6" data-enter>
          {Object.entries(byDay).map(([day, items]) => (
            <section key={day}>
              <div className="mb-2.5 flex items-center gap-3">
                <h2 className="text-tiny font-semibold uppercase tracking-[0.05em] text-muted">{day}</h2>
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="text-micro tabular text-subtle">{items.length}</span>
              </div>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {items.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      onClick={() => setViewing(photo)}
                      className="group relative block w-full overflow-hidden rounded-control border border-line"
                    >
                      <img
                        src={api.site.photoUrl(photo.id)}
                        alt={photo.description || photo.name || 'Site photo'}
                        loading="lazy"
                        className="aspect-square w-full object-cover transition-transform duration-300 group-active:scale-[0.97]"
                      />
                      <span
                        className={cn(
                          'absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-1 text-left text-[0.5625rem] font-medium uppercase tracking-[0.05em] text-paper',
                        )}
                      >
                        {photo.category}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <PhotoUploadSheet
        open={uploading}
        onClose={() => setUploading(false)}
        onSaved={reload}
        defaultCategory={category === 'all' ? 'other' : category}
      />
      <PhotoLightbox photo={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
