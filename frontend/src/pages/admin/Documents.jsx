import { useMemo, useState } from 'react'
import { Download, FileText, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { documentService, projectService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { documentTypeLabel, fileSize, formatDate, DOCUMENT_TYPE_LABELS } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { ConfirmDialog } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RowMenu } from '@/features/admin/RowMenu'

export default function AdminDocuments() {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const [project, setProject] = useState('')
  const [docType, setDocType] = useState('')

  const { data, error, loading, reload } = useAsync(
    () =>
      documentService.list({
        q: debounced || undefined,
        project_id: project || undefined,
        doc_type: docType || undefined,
      }),
    [debounced, project, docType],
  )
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)

  const remove = async (doc) => {
    setBusy(true)
    try {
      await documentService.remove(doc.id)
      toast.success(`${doc.name} deleted.`)
      setConfirm(null)
      reload()
    } catch (err) {
      toast.error(err.status === 403 ? 'Your role cannot delete documents.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Document',
        value: (row) => row.name,
        render: (row) => (
          <div className="min-w-0">
            <span className="block truncate font-medium text-ink">{row.name}</span>
            <span className="block truncate text-tiny text-subtle">
              {row.project_name} · {fileSize(row.size_bytes)}
            </span>
          </div>
        ),
      },
      {
        key: 'doc_type',
        header: 'Type',
        value: (row) => row.doc_type,
        render: (row) => (
          <span className="whitespace-nowrap rounded-pill border border-line bg-raised px-2 py-0.5 text-micro text-muted">
            {documentTypeLabel(row.doc_type)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Processing',
        value: (row) => row.status,
        render: (row) => (
          <StatusBadge
            status={
              row.status === 'processed'
                ? 'completed'
                : row.status === 'failed'
                  ? 'critical'
                  : 'in_progress'
            }
            label={row.status === 'processed' ? 'Processed' : row.status === 'failed' ? 'Failed' : 'Processing'}
            size="sm"
          />
        ),
      },
      {
        key: 'uploaded_by_name',
        header: 'Uploaded by',
        value: (row) => row.uploaded_by_name,
        render: (row) => <span className="truncate text-muted">{row.uploaded_by_name || '—'}</span>,
      },
      {
        key: 'uploaded_at',
        header: 'Uploaded',
        align: 'right',
        sortValue: (row) => row.uploaded_at || '',
        render: (row) => (
          <span className="whitespace-nowrap text-tiny text-muted">{formatDate(row.uploaded_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        width: '3rem',
        align: 'right',
        render: (row) => (
          <RowMenu
            label={`Actions for ${row.name}`}
            items={[
              {
                label: 'Download',
                icon: Download,
                onSelect: () => window.open(api.documents.downloadUrl(row.id), '_blank', 'noopener'),
              },
              { label: 'Delete document', icon: Trash2, destructive: true, onSelect: () => setConfirm(row) },
            ]}
          />
        ),
      },
    ],
    [],
  )

  const totalBytes = (data || []).reduce((sum, row) => sum + (row.size_bytes || 0), 0)

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Documents"
        description="Every file uploaded to the platform, who uploaded it, and whether BuildSync could read it."
      />

      {data && (
        <div data-enter className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-tiny text-muted">
          <span>
            <span className="font-medium tabular text-ink">{data.length}</span> documents
          </span>
          <span>
            <span className="font-medium tabular text-ink">{fileSize(totalBytes)}</span> stored
          </span>
          {data.filter((d) => d.status === 'failed').length > 0 && (
            <span className="text-critical">
              <span className="font-medium tabular">
                {data.filter((d) => d.status === 'failed').length}
              </span>{' '}
              failed to process
            </span>
          )}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search documents…"
          filters={[
            {
              key: 'project',
              label: 'All projects',
              value: project,
              onChange: setProject,
              options: (projects || []).map((p) => ({ value: p.id, label: p.name })),
            },
            {
              key: 'doc_type',
              label: 'All types',
              value: docType,
              onChange: setDocType,
              options: Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
        />
      </div>

      <div data-enter>
        <AdminTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data}
          columns={columns}
          filtered={Boolean(debounced || project || docType)}
          minWidth="64rem"
          emptyIcon={FileText}
          emptyTitle="No documents yet"
          emptyDescription="Uploads appear here once someone adds a file to a project."
          filteredTitle="No documents found"
          errorTitle="Unable to load documents"
        />
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm ? `Delete ${confirm.name}?` : ''}
        description="This removes the file from storage and everything BuildSync extracted from it. It cannot be undone."
        confirmLabel="Delete document"
        loading={busy}
        onConfirm={() => confirm && remove(confirm)}
      />
    </div>
  )
}
