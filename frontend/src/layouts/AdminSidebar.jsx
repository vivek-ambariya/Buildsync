import { useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity, Boxes, Building2, FileBarChart, FileText, Hammer, LayoutDashboard,
  ListChecks, Radar, Receipt, Settings, ShieldCheck, Users, X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'
import { LogoLink } from '@/components/LogoLink'

/**
 * Admin navigation, grouped the way the work divides: the records the
 * platform holds, the intelligence built on them, then the platform itself.
 */
const SECTIONS = [
  {
    label: 'Control centre',
    items: [{ to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Records',
    items: [
      { to: '/admin/projects', label: 'Projects', icon: Building2 },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/tasks', label: 'Tasks', icon: ListChecks },
      { to: '/admin/materials', label: 'Materials', icon: Boxes },
      { to: '/admin/expenses', label: 'Expenses', icon: Receipt },
      { to: '/admin/documents', label: 'Documents', icon: FileText },
      { to: '/admin/site-updates', label: 'Site updates', icon: Hammer },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/admin/ai', label: 'AI intelligence', icon: Radar },
      { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/activity', label: 'Activity logs', icon: Activity },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function AdminSidebar({ mobileOpen, onClose }) {
  const location = useLocation()
  const listRef = useRef(null)
  const indicatorRef = useRef(null)

  // One marker slides to the active row, so moving around the control centre
  // reads as a single object travelling rather than a colour reappearing.
  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    const active = list.querySelector('a[aria-current="page"]')
    if (!active) {
      gsap.set(indicator, { opacity: 0 })
      return
    }
    const target = { y: active.offsetTop, height: active.offsetHeight, opacity: 1 }
    if (prefersReducedMotion()) gsap.set(indicator, target)
    else gsap.to(indicator, { ...target, duration: 0.28, ease: 'power3.out' })
  }, [location.pathname])

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col border-r border-line bg-surface',
          'transition-transform duration-300 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <LogoLink size={26} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-control p-1.5 text-subtle transition-colors hover:bg-raised hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        {/* Says which surface you are on, so /admin is never mistaken for /app. */}
        <div className="shrink-0 border-b border-line px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-amber/30 bg-amber-wash px-2 py-0.5 text-micro font-medium text-amber-deep">
            <ShieldCheck size={11} strokeWidth={2.2} />
            Admin mode
          </span>
        </div>

        <nav ref={listRef} className="relative flex-1 overflow-y-auto px-2.5 py-4">
          <span
            ref={indicatorRef}
            className="pointer-events-none absolute left-2.5 right-2.5 rounded-control bg-raised opacity-0"
            aria-hidden
          />
          {SECTIONS.map((section) => (
            <div key={section.label} className="mb-5 last:mb-0">
              <p className="mb-1.5 px-2.5 text-micro font-medium text-subtle">{section.label}</p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'relative z-10 flex items-center gap-2.5 rounded-control px-2.5 py-2 text-base',
                          'transition-colors duration-150',
                          isActive ? 'font-medium text-ink' : 'text-muted hover:text-ink',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <span className="flex flex-1 items-center gap-2.5">
                          <item.icon
                            size={15}
                            strokeWidth={isActive ? 2.2 : 1.9}
                            className={isActive ? 'text-amber-deep' : ''}
                          />
                          {item.label}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line px-2.5 py-3">
          <NavLink
            to="/app"
            className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-base text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <LayoutDashboard size={15} strokeWidth={1.9} />
            Back to workspace
          </NavLink>
        </div>
      </aside>
    </>
  )
}
