import { useMemo, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { documentTypeLabel, fileSize, formatDate } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { Input } from '@/components/ui/Form'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { useSite } from '@/features/site-ops/SiteContext'
import { FilterStrip, SitePageHeader } from '@/features/site-ops/SitePageHeader'

/**
 * The papers you need standing on site: drawings, the BOQ, instructions,
 * safety documents.
 *
 * Invoices and contracts are not here, and not because the list is filtered
 * in the browser — the API does not send them. A commercial document has no
 * business on a phone in a hard hat, and keeping the decision server-side
 * means the client cannot leak what it never received.
 */
export default function SiteDocuments() {
  const { projectId, project } = useSite()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const search = useDebounced(query, 250)

  const { data, error, loading, reload } = useAsync(
    () => (projectId ? api.site.documents({ project_id: projectId, q: search || undefined }) : Promise.resolve([])),
    [projectId, search],
  )
  const scope = useEnter([loading, Boolean(data)])

  const documents = data || []
  const counts = useMemo(
    () =>
      documents.reduce((out, doc) => {
        out[doc.doc_type] = (out[doc.doc_type] || 0) + 1
        return out
      }, {}),
    [documents],
  )
  const visible = type === 'all' ? documents : documents.filter((doc) => doc.doc_type === type)

  if (error) {
    return <ErrorState title="We could not load site documents" description={error.message} onRetry={reload} />
  }

  return (
    <div ref={scope}>
      <SitePageHeader
        title="Documents"
        count={documents.length}
        countLabel={`for ${project?.name || 'this site'}`}
      >
        <div className="relative mt-3.5">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search drawings, BOQ, instructions…"
            className="h-12 pl-9 text-base"
            aria-label="Search documents"
          />
        </div>
        <FilterStrip
          className="mt-2.5"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All', count: documents.length },
            { value: 'drawing', label: 'Drawings', count: counts.drawing || 0 },
            { value: 'boq', label: 'BOQ', count: counts.boq || 0 },
            { value: 'site_report', label: 'Site reports', count: counts.site_report || 0 },
            { value: 'other', label: 'Other', count: counts.other || 0 },
          ]}
        />
      </SitePageHeader>

      {loading && !data ? (
        <div className="space-y-2" data-enter>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-panel border border-line p-4">
              <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface" data-enter>
          <EmptyState
            compact
            icon={FileText}
            title={search ? 'Nothing matches that' : 'No documents for this site yet'}
            description={
              search
                ? 'Try a shorter search, or clear it to see everything.'
                : 'Drawings, the BOQ and site instructions appear here once they are uploaded to the project.'
            }
          />
        </div>
      ) : (
        <ul className="space-y-2" data-enter>
          {visible.map((doc) => (
            <li key={doc.id}>
              <a
                href={api.documents.downloadUrl(doc.id)}
                target="_blank"
                rel="noreferrer"
                className="tap-lg flex items-center gap-3 rounded-panel border border-line bg-surface px-4 transition-colors active:bg-raised"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-line bg-raised text-subtle">
                  <FileText size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink">{doc.name}</span>
                  <span className="block truncate text-tiny text-subtle">
                    {documentTypeLabel(doc.doc_type)} · {fileSize(doc.size_bytes)} ·{' '}
                    {formatDate(doc.uploaded_at, { withYear: false })}
                  </span>
                </span>
                <Download size={17} className="shrink-0 text-subtle" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
