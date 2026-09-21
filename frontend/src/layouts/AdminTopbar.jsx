import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, Bell, LogOut, Menu, Search, Settings } from 'lucide-react'

import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Avatar } from '@/components/ui/Avatar'
import { NotificationPanel } from '@/components/NotificationPanel'

/**
 * The control centre's top bar.
 *
 * Deliberately a sibling of the workspace `Topbar` rather than a variant of
 * it: the admin account menu leads somewhere different, and the two surfaces
 * are free to diverge without either growing a flag for the other.
 */
export function AdminTopbar({ onMenu, onSearch }) {
  const { user, signOut, roleLabel } = useAuth()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const menuRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    api.notifications
      .list()
      .then((data) => {
        if (!cancelled) setUnread(data.unread || 0)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onClickAway = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', onClickAway), 0)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      clearTimeout(timer)
    }
  }, [menuOpen])

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  const menuItems = [
    { to: '/admin/settings', label: 'Settings', icon: Settings },
    { to: '/admin/activity', label: 'Activity', icon: Activity },
  ]

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="-ml-1.5 rounded-control p-2 text-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className={cn(
          'hidden h-9 flex-1 items-center gap-2.5 rounded-control border border-line bg-surface px-3 sm:flex',
          'max-w-sm text-left transition-colors duration-150 hover:border-line-strong',
        )}
      >
        <Search size={14} className="shrink-0 text-subtle" />
        <span className="flex-1 truncate text-base text-subtle">Search the platform…</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-line bg-raised px-1.5 py-0.5 text-micro text-subtle md:inline-flex">
          {isMac ? '⌘' : 'Ctrl'} K
        </kbd>
      </button>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search"
        className="rounded-control p-2 text-muted transition-colors hover:bg-raised hover:text-ink sm:hidden"
      >
        <Search size={17} />
      </button>

      <div className="ml-auto flex items-center gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen((value) => !value)}
            className="relative rounded-control p-2 text-muted transition-colors hover:bg-raised hover:text-ink"
            aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
          >
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-amber px-1 text-[0.5625rem] font-semibold tabular text-[#1A1405]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <NotificationPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            onReadAll={() => setUnread(0)}
          />
        </div>

        <div ref={menuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-2 rounded-control py-1 pl-1 pr-2 transition-colors hover:bg-raised"
            aria-label="Admin account"
          >
            <Avatar name={user?.name} initials={user?.avatar_initials} size="sm" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[9rem] truncate text-tiny font-medium text-ink">
                {user?.name}
              </span>
              <span className="block text-micro text-amber-deep">{roleLabel}</span>
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-panel border border-line bg-surface shadow-popover">
              <div className="border-b border-line px-3.5 py-3">
                <p className="truncate text-base font-medium text-ink">{user?.name}</p>
                <p className="truncate text-tiny text-muted">{user?.email}</p>
                <p className="mt-1 text-micro font-medium text-amber-deep">{roleLabel}</p>
              </div>
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2.5 text-base text-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  signOut()
                  navigate('/login')
                }}
                className="flex w-full items-center gap-2 border-t border-line px-3.5 py-2.5 text-left text-base text-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <LogOut size={14} />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
