import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertTriangle, Check, Info, X } from 'lucide-react'

import { cn } from './cn'

const ToastContext = createContext(null)
let nextId = 0

const TONE = {
  success: { icon: Check, className: 'text-healthy' },
  error: { icon: AlertTriangle, className: 'text-critical' },
  info: { icon: Info, className: 'text-info' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const push = useCallback(
    (message, tone = 'success', detail) => {
      const id = (nextId += 1)
      setToasts((all) => [...all, { id, message, tone, detail }])
      setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4000)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, detail) => push(message, 'success', detail),
      error: (message, detail) => push(message, 'error', detail),
      info: (message, detail) => push(message, 'info', detail),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[90] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((item) => {
          const { icon: Icon, className } = TONE[item.tone] || TONE.info
          return (
            <div
              key={item.id}
              className="pointer-events-auto flex items-start gap-3 rounded-panel border border-line bg-surface px-4 py-3 shadow-overlay"
              style={{ animation: 'toast-in 220ms cubic-bezier(0.16,1,0.3,1)' }}
            >
              <Icon size={16} className={cn('mt-0.5 shrink-0', className)} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-ink">{item.message}</p>
                {item.detail && <p className="mt-0.5 text-tiny text-muted">{item.detail}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="-mr-1 rounded p-1 text-subtle transition-colors hover:text-ink"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }`}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext) || { toast: () => {}, success: () => {}, error: () => {}, info: () => {} }
}
