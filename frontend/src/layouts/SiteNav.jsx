import { NavLink } from 'react-router-dom'
import {
  AlertTriangle, Camera, ClipboardList, FileText, Gauge, HardHat, LayoutGrid,
  ListChecks, Package, Sun, X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

/**
 * Field navigation comes from the active workspace: a site manager and a
 * contractor share this shell but not their days, so they do not share a
 * nav. The bottom bar carries the items a thumb reaches for; the rest live
 * one tap away behind "More" rather than being cut.
 */
const navFor = (workspace) => (workspace ? workspace.nav(workspace.base) : [])
const primaryOf = (nav) => nav.filter((item) => item.primary)
const secondaryOf = (nav) => nav.filter((item) => !item.primary)

/** The desktop rail. Same destinations, laid out for a pointer. */
export function SiteRail({ user, roleLabel, projectName }) {
  const { workspace } = useAuth()
  const nav = navFor(workspace)
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-line bg-surface lg:flex">
      <div className="site-band shrink-0 px-4 py-4">
        <div className="flex items-center gap-2">
          <HardHat size={18} className="text-amber" />
          <span className="font-display text-[0.9375rem] font-semibold tracking-tight">
            {workspace?.label === 'Contractor' ? 'My work' : 'Site operations'}
          </span>
        </div>
        <p className="mt-2 truncate text-tiny text-paper/70">{projectName || 'No site assigned'}</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5">
        <ul className="space-y-0.5">
          {nav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-control px-2.5 py-2.5 text-base transition-colors duration-150',
                    isActive ? 'bg-raised font-medium text-ink' : 'text-muted hover:bg-raised hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} strokeWidth={isActive ? 2.2 : 1.9} className={isActive ? 'text-amber-deep' : ''} />
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-line px-4 py-3">
        <p className="truncate text-tiny font-medium text-ink">{user?.name}</p>
        <p className="truncate text-micro text-subtle">{user?.title || roleLabel}</p>
      </div>
    </aside>
  )
}

/**
 * The bottom bar.
 *
 * Five destinations, each a full-height column so the target is the whole
 * cell rather than the icon inside it. It is the only navigation on a phone,
 * and it never scrolls away.
 */
export function SiteBottomNav({ onMore, moreOpen }) {
  const { workspace } = useAuth()
  const primary = primaryOf(navFor(workspace))
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden"
      aria-label="Site sections"
    >
      <ul className="flex pb-safe">
        {primary.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-micro font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-subtle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    <item.icon size={21} strokeWidth={isActive ? 2.3 : 1.8} />
                    {isActive && (
                      <span className="absolute -top-2.5 h-[3px] w-6 rounded-pill bg-amber" aria-hidden />
                    )}
                  </span>
                  {item.short}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            onClick={onMore}
            aria-expanded={moreOpen}
            className={cn(
              'flex h-16 w-full flex-col items-center justify-center gap-1 text-micro font-medium transition-colors',
              moreOpen ? 'text-ink' : 'text-subtle',
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center">
              {moreOpen ? <X size={21} /> : <LayoutGrid size={21} strokeWidth={1.8} />}
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** What "More" opens: the destinations the bottom bar could not hold. */
export function SiteMoreSheet({ open, onClose }) {
  const { workspace } = useAuth()
  const secondary = secondaryOf(navFor(workspace))
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-16 z-40 mb-safe border-y border-line bg-surface p-3 shadow-overlay lg:hidden">
        <ul className="grid grid-cols-2 gap-2">
          {secondary.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'tap flex items-center gap-2.5 rounded-control border border-line px-3 text-base',
                    isActive ? 'bg-raised font-medium text-ink' : 'text-muted',
                  )
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
