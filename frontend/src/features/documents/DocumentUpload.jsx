import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, FileUp, Loader2, UploadCloud, X } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { fileSize } from '@/lib/format'
import { useToast } from '@/lib/toast'
import { gsap, prefersReducedMotion } from '@/animations'
import { Button } from '@/components/ui/Button'
import { Field, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

const DOC_TYPES = [
  { value: '', label: 'Detect automatically' },
  { value: 'boq', label: 'Bill of quantities' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'contract', label: 'Contract' },
  { value: 'site_report', label: 'Site report' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'other', label: 'Other' },
]

/**
 * The four stages a document actually goes through, shown as they happen.
 * Read and Upload are real progress; Classify and Extract are server-side, so
 * they advance when the response tells us they did rather than on a timer.
 */
const STAGES = ['Uploading', 'Classifying', 'Extracting', 'Structured']

export function DocumentUpload({ open, onClose, onUploaded, projects, defaultProjectId }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const railRef = useRef(null)

  const [file, setFile] = useState(null)
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [docType, setDocType] = useState('')
  const [notes, setNotes] = useState('')
  const [dragging, setDragging] = useState(false)
  const [stage, setStage] = useState(-1)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setStage(-1)
      setProgress(0)
      setError(null)
      setNotes('')
      setDocType('')
    }
    setProjectId(defaultProjectId || '')
  }, [open, defaultProjectId])

  // The rail fills to the current stage, so the bar and the labels agree.
  useEffect(() => {
    if (!railRef.current || stage < 0) return
    const target = `${((stage + 1) / STAGES.length) * 100}%`
    if (prefersReducedMotion()) gsap.set(railRef.current, { width: target })
    else gsap.to(railRef.current, { width: target, duration: 0.45, ease: 'power2.out' })
  }, [stage])

  const pick = useCallback((selected) => {
    if (!selected) return
    if (selected.size > 25 * 1024 * 1024) {
      setError('That file is over the 25 MB limit. Upload a lighter export or split it.')
      return
    }
    setError(null)
    setFile(selected)
  }, [])

  const onDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    pick(event.dataTransfer.files?.[0])
  }

  const upload = async () => {
    if (!file || !projectId) {
      setError(!projectId ? 'Choose which project this document belongs to.' : 'Choose a file to upload.')
      return
    }
    setError(null)
    setStage(0)

    const body = new FormData()
    body.append('file', file)
    body.append('project_id', projectId)
    if (docType) body.append('doc_type', docType)
    body.append('notes', notes)

    try {
      const result = await api.documents.upload(body, (percent) => {
        setProgress(percent)
        if (percent >= 100) setStage(1)
      })
      setStage(2)
      // Let the extraction stage register before the result replaces the view.
      await new Promise((resolve) => setTimeout(resolve, 260))
      setStage(3)
      toast.success(
        'Document processed',
        result.line_items?.length
          ? `${result.line_items.length} line items extracted from ${result.name}`
          : `${result.name} is in the library`,
      )
      await new Promise((resolve) => setTimeout(resolve, 420))
      onUploaded?.(result)
    } catch (err) {
      setStage(-1)
      setError(err.message)
    }
  }

  const busy = stage >= 0

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      size="lg"
      title="Upload document"
      description="BOQs, invoices and site reports are read on upload and their figures pulled out."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {busy ? 'Working…' : 'Cancel'}
          </Button>
          <Button variant="primary" onClick={upload} loading={busy} disabled={!file || !projectId}>
            {busy ? 'Processing' : 'Upload and extract'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'relative rounded-panel border border-dashed p-6 text-center transition-colors duration-200',
            dragging ? 'border-amber bg-amber-wash/50' : 'border-line-strong bg-raised/50',
            file && 'border-solid border-line bg-surface text-left',
          )}
        >
          {!file ? (
            <>
              <UploadCloud size={22} className={cn('mx-auto', dragging ? 'text-amber-deep' : 'text-subtle')} strokeWidth={1.75} />
              <p className="mt-3 text-body text-ink">
                Drop a file here, or{' '}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink"
                >
                  browse
                </button>
              </p>
              <p className="mt-1 text-tiny text-muted">
                CSV, TXT and PDF are read for figures. Any format up to 25 MB is stored.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-line bg-raised text-subtle">
                <FileUp size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-ink">{file.name}</p>
                <p className="text-tiny text-muted">{fileSize(file.size)}</p>
              </div>
              {!busy && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded p-1.5 text-subtle transition-colors hover:bg-raised hover:text-ink"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0])}
          />
        </div>

        {/* Pipeline */}
        {busy && (
          <div className="rounded-panel border border-line bg-surface p-4">
            <div className="h-1 w-full overflow-hidden rounded-pill bg-line">
              <div ref={railRef} className="h-full rounded-pill bg-amber" style={{ width: 0 }} />
            </div>
            <ol className="mt-3 grid grid-cols-4 gap-2">
              {STAGES.map((label, index) => (
                <li key={label} className="flex items-center gap-1.5">
                  {index < stage ? (
                    <Check size={12} className="shrink-0 text-healthy" strokeWidth={2.5} />
                  ) : index === stage ? (
                    <Loader2 size={12} className="shrink-0 animate-spin text-amber-deep" />
                  ) : (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
                  )}
                  <span
                    className={cn(
                      'truncate text-micro',
                      index < stage ? 'text-muted' : index === stage ? 'font-medium text-ink' : 'text-subtle',
                    )}
                  >
                    {label}
                  </span>
                </li>
              ))}
            </ol>
            {stage === 0 && <p className="mt-2.5 text-micro tabular text-subtle">{progress}% transferred</p>}
          </div>
        )}

        {!busy && (
          <>
            <Field label="Project" required>
              <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
                <option value="">Choose a project</option>
                {(projects || []).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Document type" hint="Leave on automatic and BuildSync will classify it from the contents.">
              <Select value={docType} onChange={(event) => setDocType(event.target.value)}>
                {DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                placeholder="Revision 3 issued after the podium redesign."
              />
            </Field>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5 text-base text-critical">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
