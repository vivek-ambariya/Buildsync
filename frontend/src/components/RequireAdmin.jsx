import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { Logo } from '@/components/Logo'
import { ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'

/**
 * Keeps /admin out of the hands of people who cannot use it.
 *
 * This is a courtesy, not a defence. Every admin endpoint refuses a non-admin
 * on its own, so the worst a determined person achieves by getting past this
 * component is an empty screen full of 403s. What it buys is that nobody is
 * shown a control centre they cannot operate.
 */
export function RequireAdmin() {
  const { status, isAdmin, home } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <Logo size={34} showWordmark={false} />
        <p className="text-tiny text-subtle">Checking your access…</p>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Signed in, but not an admin. Say so plainly and point them at the place
  // they can actually work, rather than bouncing them somewhere unexplained.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Panel className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
            <ShieldAlert size={18} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-h3 text-ink">Admin access only</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            The control centre is limited to administrators. Your own workspace has
            everything your role can act on.
          </p>
          <ButtonLink to={home} variant="primary" className="mt-6">
            Go to my workspace
          </ButtonLink>
        </Panel>
      </div>
    )
  }

  return <Outlet />
}
