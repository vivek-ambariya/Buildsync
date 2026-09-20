import { useState } from 'react'
import { Download, FileText, RefreshCw, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { documentTypeLabel, fileSize, formatDate, formatINR, formatNumber, titleise } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { DataTable } from '@/components/ui/DataTable'
import { ConfirmDialog, Drawer } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/States'

/**
 * What the extractor found, next to what the file is. The extracted figures
 * are the reason to open a BOQ here rather than in a spreadsheet, so they lead.
 */
export function DocumentDetail({ document: record, open, onClose, onChanged }) {
  const { can } = useAuth()
  const toast = useToast()
  const [reprocessing, setReprocessing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [current, setCurrent] = useState(record)

  const doc = current?.id === record?.id ? current : record
  if (!doc) return null

  const reprocess = async () => {
    setReprocessing(true)
    try {
      const updated = await api.documents.reprocess(doc.id)
      setCurrent(updated)
      toast.success('Document re-read', `${updated.line_items?.length || 0} line items found`)
      onChanged?.()
    } catch (err) {
      toast.error('Could not re-read that document', err.message)
    } finally {
      setReprocessing(false)
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await api.documents.remove(doc.id)
      toast.success('Document deleted', doc.name)
      setDeleting(false)
      onClose()
      onChanged?.()
    } catch (err) {
      toast.error('Could not delete that document', err.message)
      setRemoving(false)
    }
  }

  const fields = Object.entries(doc.extracted_fields || {})
  const items = doc.line_items || []

  const columns = [
    { key: 'material', header: 'Item', render: (row) => <span className="text-ink">{row.material}</span> },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      width: '120px',
      render: (row) => (
        <span className="text-muted">
          {row.quantity !== null && row.quantity !== undefined ? formatNumber(row.quantity, 1) : '—'}
          {row.unit && <span className="ml-1 text-micro text-subtle">{row.unit}</span>}
        </span>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      width: '110px',
      render: (row) => <span className="text-muted">{row.rate ? formatINR(row.rate, { compact: false }) : '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: '120px',
      render: (row) => <span className="text-ink">{row.amount ? formatINR(row.amount) : '—'}</span>,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      width: '170px',
      render: (row) => <span className="truncate text-muted">{row.vendor || '—'}</span>,
    },
  ]

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={doc.name}
      description={`${documentTypeLabel(doc.doc_type)} · ${fileSize(doc.size_bytes)} · uploaded ${formatDate(doc.uploaded_at)} by ${doc.uploaded_by_name || 'a team member'}`}
      width="max-w-3xl"
      footer={
        <>
          {can('uploadDocuments') && (
            <>
              <Button variant="ghost" onClick={() => setDeleting(true)}>
                <Trash2 size={14} />
                Delete
              </Button>
              <Button variant="secondary" onClick={reprocess} loading={reprocessing}>
                <RefreshCw size={14} />
                Re-read
              </Button>
            </>
          )}
          <Button variant="primary" href={api.documents.downloadUrl(doc.id)}>
            <Download size={14} />
            Download
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={doc.status === 'processed' ? 'completed' : doc.status} label={titleise(doc.status)} size="sm" />
          {doc.detected_type && (
            <span className="rounded-pill border border-line bg-raised px-2.5 py-1 text-tiny text-muted">
              Classified as {documentTypeLabel(doc.detected_type)}
              {doc.classification_confidence ? ` · ${Math.round(doc.classification_confidence * 100)}% confidence` : ''}
            </span>
          )}
          {doc.extractor && (
            <span className="rounded-pill border border-line bg-raised px-2.5 py-1 text-tiny text-muted">
              Read by {doc.extractor === 'rules' ? 'the local extractor' : doc.extractor}
            </span>
          )}
        </div>

        {doc.notes && (
          <div>
            <p className="text-tiny font-medium text-muted">Notes</p>
            <p className="mt-1 text-base leading-relaxed text-ink">{doc.notes}</p>
          </div>
        )}

        {/* Extracted fields */}
        <section>
          <h3 className="panel-title mb-2.5">Extracted data</h3>
          {fields.length === 0 ? (
            <div className="rounded-panel border border-line">
              <EmptyState
                compact
                icon={FileText}
                title="No structured data found"
                description="This file has no readable text layer. Download it to view the original, or re-read it after converting to CSV or text."
              />
            </div>
          ) : (
            <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2">
              {fields.map(([label, value], index) => (
                <div
                  key={label}
                  className={cn(
                    'bg-surface px-4 py-3',
                    // An odd number of fields would leave the container's
                    // background showing as an empty cell.
                    index === fields.length - 1 && fields.length % 2 === 1 && 'sm:col-span-2',
                  )}
                >
                  <dt className="text-micro text-subtle">{label}</dt>
                  <dd className="mt-0.5 break-words text-base tabular text-ink">{String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {/* Line items */}
        {items.length > 0 && (
          <section>
            <div className="mb-2.5 flex items-end justify-between gap-3">
              <h3 className="panel-title">Line items</h3>
              <p className="text-tiny text-muted">
                {items.length} rows ·{' '}
                <span className="tabular text-ink">{formatINR(doc.total_value)}</span> total
              </p>
            </div>
            <div className="overflow-hidden rounded-panel border border-line">
              <DataTable
                columns={columns}
                rows={items}
                rowKey={(row, index) => `${row.material}-${index}`}
                minWidth="34rem"
                dense
              />
            </div>
          </section>
        )}

        {doc.text_preview && (
          <section>
            <h3 className="panel-title mb-2.5">Source text</h3>
            <pre
              className={cn(
                'max-h-56 overflow-auto whitespace-pre-wrap rounded-panel border border-line bg-raised',
                'p-4 text-tiny leading-relaxed text-muted',
              )}
            >
              {doc.text_preview}
            </pre>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={deleting}
        loading={removing}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        title={`Delete ${doc.name}?`}
        confirmLabel="Delete document"
        description="The file and everything extracted from it will be removed from the project."
      />
    </Drawer>
  )
}
