import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, Image, Receipt, ScrollText, Search, Upload } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { documentTypeLabel, fileSize, formatINR, relativeTime, titleise } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { Panel } from '@/components/ui/Panel'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { DocumentDetail } from './DocumentDetail'
import { DocumentUpload } from './DocumentUpload'

const TYPE_META = {
  boq: { icon: FileSpreadsheet, label: 'BOQ' },
  invoice: { icon: Receipt, label: 'Invoice' },
  contract: { icon: ScrollText, label: 'Contract' },
  site_report: { icon: FileText, label: 'Site report' },
  drawing: { icon: Image, label: 'Drawing' },
  other: { icon: FileText, label: 'Other' },
}

const TYPES = Object.keys(TYPE_META)

export function DocumentLibrary({ projectId, projects, showProjectColumn = true }) {
  const { can } = useAuth()
  const { data, error, loading, reload } = useAsync(
    () => api.documents.list(projectId ? { project_id: projectId } : undefined),
    [projectId],
  )

  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState(null)

  const filtered = useMemo(() => {
    let rows = data || []
    const term = query.trim().toLowerCase()
    if (term) {
      rows = rows.filter(
        (doc) =>
          doc.name.toLowerCase().includes(term) ||
          (doc.notes || '').toLowerCase().includes(term) ||
          (doc.project_name || '').toLowerCase().includes(term),
      )
    }
    if (type) rows = rows.filter((doc) => doc.doc_type === type)
    return rows
  }, [data, query, type])

  const extractedValue = useMemo(
    () => (data || []).reduce((sum, doc) => sum + (doc.total_value || 0), 0),
    [data],
  )

  if (error) return <ErrorState title="We could not load the documents" description={error.message} onRetry={reload} />

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search file names and notes"
            className="pl-9"
            aria-label="Search documents"
          />
        </div>
        <Select value={type} onChange={(event) => setType(event.target.value)} className="w-auto" aria-label="Filter by document type">
          <option value="">All types</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>{TYPE_META[value].label}</option>
          ))}
        </Select>
        {extractedValue > 0 && (
          <p className="text-tiny text-muted">
            <span className="tabular text-ink">{formatINR(extractedValue)}</span> of priced work read from these files
          </p>
        )}
        {can('uploadDocuments') && (
          <Button variant="primary" className="lg:ml-auto" onClick={() => setUploading(true)}>
            <Upload size={15} />
            Upload document
          </Button>
        )}
      </div>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Panel key={index} className="p-4">
              <Skeleton className="h-9 w-9 rounded-control" />
              <Skeleton className="mt-3 h-3.5 w-40" />
              <Skeleton className="mt-2 h-2.5 w-24" />
              <Skeleton className="mt-4 h-2.5 w-full" />
            </Panel>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FileText}
            title={query || type ? 'No documents match' : 'No documents yet'}
            description={
              query || type
                ? 'Try a different type, or clear the search to see the whole library.'
                : 'Upload a BOQ, invoice or site report and BuildSync will pull the quantities, rates and vendors out of it.'
            }
            action={
              can('uploadDocuments') && !(query || type) ? (
                <Button variant="primary" onClick={() => setUploading(true)}>
                  <Upload size={15} />
                  Upload the first document
                </Button>
              ) : null
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((doc) => {
            const meta = TYPE_META[doc.doc_type] || TYPE_META.other
            const Icon = meta.icon
            const itemCount = doc.line_items?.length || 0
            return (
              <Panel key={doc.id} interactive>
                <button
                  type="button"
                  onClick={() => setSelected(doc)}
                  className="block w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line bg-raised text-subtle">
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    <StatusBadge
                      status={doc.status === 'processed' ? 'completed' : doc.status === 'failed' ? 'critical' : 'in_progress'}
                      label={doc.status === 'processed' ? meta.label : titleise(doc.status)}
                      size="sm"
                    />
                  </div>

                  <p className="mt-3 truncate text-base font-medium text-ink" title={doc.name}>
                    {doc.name}
                  </p>
                  <p className="mt-0.5 truncate text-tiny text-muted">
                    {showProjectColumn && doc.project_name ? `${doc.project_name} · ` : ''}
                    {fileSize(doc.size_bytes)}
                  </p>

                  <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-line pt-3">
                    <div className="min-w-0">
                      {itemCount > 0 ? (
                        <>
                          <p className="text-micro text-subtle">Extracted</p>
                          <p className="truncate text-base tabular text-ink">
                            {itemCount} items · {formatINR(doc.total_value)}
                          </p>
                        </>
                      ) : (
                        <p className={cn('truncate text-tiny', doc.status === 'failed' ? 'text-critical' : 'text-subtle')}>
                          {doc.status === 'failed' ? 'Could not be read' : 'Stored, no figures found'}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-micro text-subtle">{relativeTime(doc.uploaded_at)}</p>
                  </div>
                </button>
              </Panel>
            )
          })}
        </div>
      )}

      <DocumentUpload
        open={uploading}
        projects={projects}
        defaultProjectId={projectId}
        onClose={() => setUploading(false)}
        onUploaded={() => {
          setUploading(false)
          reload()
        }}
      />

      <DocumentDetail
        open={Boolean(selected)}
        document={selected}
        onClose={() => setSelected(null)}
        onChanged={reload}
      />
    </div>
  )
}
