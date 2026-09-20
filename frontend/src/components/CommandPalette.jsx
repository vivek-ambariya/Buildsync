import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Building2, CornerDownLeft, FileText, IndianRupee, LayoutDashboard,
  ListChecks, Package, Search, Sparkles, User, Loader2,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useDebounced } from '@/lib/useAsync'
import { gsap, prefersReducedMotion } from '@/animations'

const TYPE_META = {
  project: { icon: Building2, label: 'Project' },
  task: { icon: ListChecks, label: 'Task' },
  document: { icon: FileText, label: 'Document' },
  material: { icon: Package, label: 'Material' },
  expense: { icon: IndianRupee, label: 'Expense' },
  person: { icon: User, label: 'Person' },
  page: { icon: ArrowRight, label: 'Go to' },
}

const PAGES = [
  { id: 'p-dashboard', type: 'page', title: 'Dashboard', subtitle: 'Portfolio overview', href: '/app' },
  { id: 'p-projects', type: 'page', title: 'Projects', subtitle: 'All construction projects', href: '/app/projects' },
  { id: 'p-documents', type: 'page', title: 'Documents', subtitle: 'BOQs, invoices and drawings', href: '/app/documents' },
  { id: 'p-site', type: 'page', title: 'Site updates', subtitle: 'Daily progress reports', href: '/app/site-updates' },
  { id: 'p-assistant', type: 'page', title: 'Ask BuildSync', subtitle: 'Construction copilot', href: '/app/assistant' },
  { id: 'p-insights', type: 'page', title: 'AI insights', subtitle: 'Risk findings across the portfolio', href: '/app/insights' },
  { id: 'p-reports', type: 'page', title: 'Reports', subtitle: 'Generate a project report', href: '/app/reports' },
  { id: 'p-team', type: 'page', title: 'Team', subtitle: 'People and roles', href: '/app/team' },
]

export function CommandPalette({ open, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const debounced = useDebounced(query, 200)
  const panel = useRef(null)
  const overlay = useRef(null)
  const listRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || prefersReducedMotion()) return
    gsap.fromTo(overlay.current, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: -10, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.26, ease: 'power3.out' },
    )
  }, [open])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = debounced.trim()
    if (term.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    api
      .search(term)
      .then((data) => {
        if (!cancelled) setResults(data.results || [])
      })
      .catch(() => {
        if (!cancelled) setResults([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, open])

  const items = useMemo(() => {
    const term = query.trim().toLowerCase()
    const pages = term
      ? PAGES.filter((page) => page.title.toLowerCase().includes(term) || page.subtitle.toLowerCase().includes(term))
      : PAGES
    return term.length < 2 ? pages : [...pages.slice(0, 3), ...results]
  }, [query, results])

  useEffect(() => setActive(0), [items.length])

  const choose = useCallback(
    (item) => {
      if (!item) return
      onClose()
      navigate(item.href)
    },
    [navigate, onClose],
  )

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => Math.min(index + 1, items.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => Math.max(index - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        choose(items[active])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, items, active, choose, onClose])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh] sm:px-6">
      <div ref={overlay} className="fixed inset-0 bg-ink/40 backdrop-blur-[3px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search BuildSync"
        className="relative w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface shadow-overlay"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          {loading ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-subtle" />
          ) : (
            <Search size={16} className="shrink-0 text-subtle" />
          )}
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, tasks, documents, materials…"
            className="h-12 w-full bg-transparent text-body text-ink placeholder:text-subtle focus:outline-none"
            aria-label="Search"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-raised px-1.5 py-0.5 text-micro text-subtle sm:block">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[22rem] overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-base text-muted">
              {query.trim().length < 2
                ? 'Type at least two characters to search.'
                : `Nothing matches “${query.trim()}”.`}
            </p>
          ) : (
            items.map((item, index) => {
              const meta = TYPE_META[item.type] || TYPE_META.page
              const Icon = meta.icon
              return (
                <button
                  key={item.id || `${item.type}-${index}`}
                  type="button"
                  data-active={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100',
                    index === active ? 'bg-raised' : 'hover:bg-raised/60',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-control border',
                      index === active ? 'border-line-strong bg-surface text-ink' : 'border-line text-subtle',
                    )}
                  >
                    <Icon size={13} strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base text-ink">{item.title}</span>
                    <span className="block truncate text-tiny text-muted">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-micro text-subtle">{meta.label}</span>
                  {index === active && <CornerDownLeft size={12} className="shrink-0 text-subtle" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-raised px-4 py-2 text-micro text-subtle">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-surface px-1">↑</kbd>
            <kbd className="rounded border border-line bg-surface px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-surface px-1">↵</kbd>
            open
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <Sparkles size={11} />
            Ask BuildSync for anything numbers can answer
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Registers ⌘K / Ctrl+K globally. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return { open, setOpen, close: () => setOpen(false) }
}
