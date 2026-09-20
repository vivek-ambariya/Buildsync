import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { drawerIn, modalIn } from '@/animations'

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

function useOverlay(open, onClose) {
  const panel = useRef(null)
  const overlay = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  // Move focus into the dialog so the keyboard stays inside it.
  useEffect(() => {
    if (!open) return
    const focusable = panel.current?.querySelector(
      'input, select, textarea, button:not([data-close]), [href]',
    )
    focusable?.focus?.()
  }, [open])

  return { panel, overlay }
}

export function Modal({ open, onClose, title, description, size = 'md', footer, children }) {
  const { panel, overlay } = useOverlay(open, onClose)

  useLayoutEffect(() => {
    if (open) modalIn(panel.current, overlay.current)
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
      <div
        ref={overlay}
        className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative my-auto w-full rounded-panel border border-line bg-surface shadow-overlay',
          WIDTHS[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-h4 text-ink">{title}</h2>
            {description && <p className="mt-1 text-tiny text-muted">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="-mr-1 -mt-0.5 rounded-control p-1.5 text-subtle transition-colors hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[min(70vh,44rem)] overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, description, width = 'max-w-xl', children, footer }) {
  const { panel, overlay } = useOverlay(open, onClose)

  useLayoutEffect(() => {
    if (open) drawerIn(panel.current, overlay.current)
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end">
      <div ref={overlay} className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('relative flex h-full w-full flex-col border-l border-line bg-surface shadow-overlay', width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-h4 text-ink">{title}</h2>
            {description && <p className="mt-1 text-tiny text-muted">{description}</p>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            className="-mr-1 -mt-0.5 rounded-control p-1.5 text-subtle transition-colors hover:bg-raised hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** A destructive action always states what will be lost before it happens. */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Delete', loading }) {
  const confirm = useCallback(async () => {
    await onConfirm?.()
  }, [onConfirm])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-control border border-line px-3.5 text-base font-medium text-ink transition-colors hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={loading}
            className="h-9 rounded-control bg-critical px-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-body leading-relaxed text-muted">{description}</p>
    </Modal>
  )
}
