import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { workspaceForSlug } from '@/lib/workspaces'
import { Logo } from '@/components/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'

/**
 * Keeps a workspace's routes to the people who hold it.
 *
 * This is UX, not security. Every endpoint behind these screens authorises
 * the request again from the roles stored on the account, so the worst that
 * getting past this component achieves is a page of refusals. What it buys is
 * that nobody is handed a workspace they cannot operate, and that someone who
 * lands on the wrong URL is told why and where to go instead.
 */
export function RequireWorkspace({ slug }) {
  const { status, authorizedRoles, authorizedWorkspaces, home, signOut } = useAuth()
  const location = useLocation()
  const workspace = workspaceForSlug(slug)

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <Logo size={34} showWordmark={false} />
        <p className="text-tiny text-subtle">Checking your access…</p>
      </div>
    )
  }

  if (status === 'anonymous') {
    // Remember both the page and the workspace, so signing in returns here
    // with the right card already chosen.
    return <Navigate to="/login" replace state={{ from: location, workspace: slug }} />
  }

  if (workspace && !authorizedRoles.includes(workspace.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Panel className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
            <ShieldAlert size={18} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-h3 text-ink">Access denied</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            You don't have permission to access the {workspace.label} workspace.
          </p>

          {authorizedWorkspaces.length > 0 && (
            <p className="mt-3 text-tiny text-subtle">
              Your account can open{' '}
              {authorizedWorkspaces.map((w) => w.label).join(' and ')}.
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
