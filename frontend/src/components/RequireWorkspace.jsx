import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { workspaceForSlug } from '@/lib/workspaces'
import { Logo } from '@/components/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'

/**
 * Keeps a workspace's routes to the people whose account is for it.
 *
 * An account has one role and therefore one workspace, so this is a plain
 * yes or no — there is nothing to switch into and no second password to ask
 * for. Someone who wants a different workspace signs in to the account that
 * holds it.
 *
 * It is UX, not security. Every endpoint behind these screens authorises the
 * request again from the role stored on the account, so the worst that
 * getting past this component achieves is a page of refusals. What it buys is
 * that someone who lands on the wrong URL is told why and where to go.
 */
export function RequireWorkspace({ slug }) {
  const { status, workspace: current, home, signOut } = useAuth()
  const location = useLocation()
  const target = workspaceForSlug(slug)

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

  if (target && current?.slug !== slug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Panel className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
            <ShieldAlert size={18} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-h3 text-ink">Access denied</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            You don&apos;t have permission to access the {target.label} workspace.
          </p>

          {current && (
            <p className="mt-3 text-tiny text-subtle">
              This account opens the {current.label} workspace.
            </p>
          )}

          <div className="mt-6 flex flex-col items-center gap-2.5">
            <ButtonLink to={home} variant="primary" className="w-full">
              Return to my workspace
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign in as someone else
            </Button>
          </div>
        </Panel>
      </div>
    )
  }

  return <Outlet />
}
