import { useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Building2, FileBarChart, FileText, Hammer, LayoutDashboard,
  MessageSquareText, Radar, Users, X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { gsap, prefersReducedMotion } from '@/animations'
import { LogoLink } from '@/components/LogoLink'

/**
 * Navigation is grouped by what the person is doing, not by data model:
 * the work itself, then the intelligence built on top of it.
 */
const SECTIONS = [
  {
    label: 'Portfolio',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/projects', label: 'Projects', icon: Building2 },
      { to: '/app/site-updates', label: 'Site updates', icon: Hammer },
      { to: '/app/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/assistant', label: 'Ask BuildSync', icon: MessageSquareText },
      { to: '/app/insights', label: 'AI insights', icon: Radar },
      { to: '/app/reports', label: 'Reports', icon: FileBarChart, permission: 'generateReports' },
    ],
  },
  {
    label: 'Organisation',
    items: [{ to: '/app/team', label: 'Team', icon: Users }],
  },
]

export function Sidebar({ mobileOpen, onClose }) {
  const { can, user, roleLabel } = useAuth()
  const location = useLocation()
  const listRef = useRef(null)
  const indicatorRef = useRef(null)

  // A single marker slides between sections, so the active place is always
  // one object moving rather than a colour appearing somewhere new.
  useLayoutEffect(() => {
    const list = listRef.current
    const indicator = indicatorRef.current
    if (!list || !indicator) return
    // NavLink marks the active anchor with aria-current, and the anchor is
    // the full-height row the marker should cover.
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
        <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden" onClick={onClose} aria-hidden />
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

        <nav ref={listRef} className="relative flex-1 overflow-y-auto px-2.5 py-4">
          <span
            ref={indicatorRef}
            className="pointer-events-none absolute left-2.5 right-2.5 rounded-control bg-raised opacity-0"
            aria-hidden
          />
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => !item.permission || can(item.permission))
            if (!items.length) return null
            return (
              <div key={section.label} className="mb-5 last:mb-0">
                <p className="mb-1.5 px-2.5 text-micro font-medium text-subtle">{section.label}</p>
                <ul className="space-y-0.5">
                  {items.map((item) => (
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
                          <span data-active={isActive} className="flex flex-1 items-center gap-2.5">
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
            )
          })}
        </nav>

        <div className="shrink-0 border-t border-line px-4 py-3">
          <p className="truncate text-tiny font-medium text-ink">{user?.name}</p>
          <p className="truncate text-micro text-subtle">{user?.title || roleLabel}</p>
        </div>
      </aside>
    </>
  )
}
