import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, HardHat, LogOut, User, WifiOff } from 'lucide-react'

import { cn } from '@/lib/cn'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { Avatar } from '@/components/ui/Avatar'
import { Logo } from '@/components/Logo'
import { SiteProvider, useSite } from '@/features/site-ops/SiteContext'
import { Sheet } from '@/features/site-ops/Sheet'
import { SiteBottomNav, SiteMoreSheet, SiteRail } from './SiteNav'
import { WorkspaceSwitcher } from '@/features/auth/WorkspaceSwitcher'

/**
 * The field app shell.
 *
 * Deliberately not the office shell. There is no command palette and no
 * search field, because neither is usable one-handed in daylight; navigation
 * lives at the bottom of the screen where the thumb is; and the header is a
 * signage band carrying the one fact that orients everything else — which
 * site you are standing on.
 */
export function SiteLayout() {
  const { status } = useAuth()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  if (status === 'loading') return <BootScreen />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />

  return (
    <SiteProvider>
      <SiteShell />
    </SiteProvider>
  )
}

function SiteShell() {
  const { user, roleLabel, workspace } = useAuth()
  // The shell is shared by two workspaces, so it never hardcodes one.
  const base = workspace?.base || '/site-manager'
  const { project } = useSite()
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMoreOpen(false), [location.pathname])

  return (
    <div className="min-h-screen bg-paper">
      <SiteRail user={user} roleLabel={roleLabel} projectName={project?.name} />

      <div className="flex min-h-screen flex-col lg:pl-[232px]">
        <SiteTopbar />
        {/* The bottom bar is fixed, so the page reserves its height. */}
        <main className="flex-1 px-4 py-4 pb-24 sm:px-6 sm:py-6 lg:pb-8">
          <div className="mx-auto w-full max-w-[1100px]">
            <Outlet />
          </div>
        </main>
      </div>

      <SiteMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      <SiteBottomNav onMore={() => setMoreOpen((value) => !value)} moreOpen={moreOpen} />
    </div>
  )
}

/**
 * The signage band.
 *
 * Which site, and everything that could interrupt you: connection, unread
 * messages, your account. Nothing else competes for the top of the screen.
 */
function SiteTopbar() {
  const { user, signOut, roleLabel } = useAuth()
  const { project, projects, selectProject } = useSite()
  const navigate = useNavigate()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const online = useOnline()

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

  return (
    <>
      <header className="site-band sticky top-0 z-30 shrink-0">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6 lg:max-w-none">
          <span className="lg:hidden">
            <HardHat size={20} className="text-amber" />
          </span>

          <button
            type="button"
            onClick={() => projects.length > 1 && setSwitcherOpen(true)}
            disabled={projects.length <= 1}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 rounded-control py-1 text-left',
              projects.length > 1 && 'active:bg-paper/10',
            )}
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-[0.9375rem] font-semibold leading-tight">
                {project?.name || 'No site assigned'}
              </span>
              <span className="block truncate text-micro text-paper/65">
                {project?.location || project?.code || 'Site operations'}
              </span>
            </span>
            {projects.length > 1 && <ChevronDown size={15} className="shrink-0 text-paper/70" />}
          </button>

          {!online && (
            <span
              className="flex items-center gap-1.5 rounded-pill bg-amber px-2 py-1 text-micro font-semibold text-[#1A1405]"
              title="You are offline. Submissions will fail until the connection returns."
            >
              <WifiOff size={12} />
              Offline
            </span>
          )}

          <button
            type="button"
            onClick={() => navigate(`${base}/notifications`)}
            aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-paper/80 transition-colors active:bg-paper/10"
          >
            <Bell size={19} />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-amber px-1 text-[0.5625rem] font-semibold tabular text-[#1A1405]">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Account"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control transition-colors active:bg-paper/10"
          >
            <Avatar
              name={user?.name}
              initials={user?.avatar_initials}
              size="sm"
              className="border-paper/25 bg-paper/10 text-paper"
            />
          </button>
        </div>
      </header>

      <Sheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Choose a site"
        description="Everything in the app follows the site you pick."
      >
        <ul className="space-y-2">
          {projects.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  selectProject(option.id)
                  setSwitcherOpen(false)
                }}
                className={cn(
                  'tap flex w-full items-center justify-between gap-3 rounded-control border px-3.5 text-left',
                  option.id === project?.id ? 'border-ink bg-raised' : 'border-line',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-ink">{option.name}</span>
                  <span className="block truncate text-tiny text-subtle">
                    {option.location || option.code} · {Math.round(option.actual_progress || 0)}% complete
                  </span>
                </span>
                {option.id === project?.id && <span className="hi-vis shrink-0">Current</span>}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={accountOpen} onClose={() => setAccountOpen(false)} title="Account">
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <Avatar name={user?.name} initials={user?.avatar_initials} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-body font-medium text-ink">{user?.name}</p>
            <p className="truncate text-tiny text-muted">{user?.email}</p>
            <p className="mt-0.5 text-micro text-subtle">{user?.title || roleLabel}</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              setAccountOpen(false)
              navigate(`${base}/profile`)
            }}
            className="tap flex w-full items-center gap-3 rounded-control border border-line px-3.5 text-base text-ink"
          >
            <User size={18} className="text-muted" />
            Profile
          </button>

          {/* Only rendered for accounts that hold more than one workspace. */}
          <WorkspaceSwitcher
            onDone={() => setAccountOpen(false)}
            className="rounded-control border border-line"
          />
          <button
            type="button"
            onClick={() => {
              setAccountOpen(false)
              signOut()
              navigate('/login')
            }}
            className="tap flex w-full items-center gap-3 rounded-control border border-critical/30 bg-critical-wash px-3.5 text-base font-medium text-critical"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </Sheet>
    </>
  )
}

/**
 * Connection state.
 *
 * A site is the one place where this genuinely changes during a session, and
 * a failed submission there costs a walk back to the office. Showing it in
 * the header is cheaper than explaining the error afterwards.
 */
function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
      <Logo size={34} showWordmark={false} />
      <p className="text-tiny text-subtle">Loading your site…</p>
    </div>
  )
}
