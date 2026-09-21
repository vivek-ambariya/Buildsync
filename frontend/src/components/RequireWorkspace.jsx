import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert, ShieldCheck } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { workspaceForSlug } from '@/lib/workspaces'
import { Logo } from '@/components/Logo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { Field } from '@/components/ui/Form'

/**
 * Keeps a workspace's routes to the people who hold it.
 *
 * If accessing Admin workspace while in another workspace, prompts for the Admin password.
 */
export function RequireWorkspace({ slug }) {
  const { status, authorizedRoles, authorizedWorkspaces, workspace: currentWorkspace, home, signOut, signIn, user } = useAuth()
  const location = useLocation()
  const targetWorkspace = workspaceForSlug(slug)

  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper">
        <Logo size={34} showWordmark={false} />
        <p className="text-tiny text-subtle">Checking your access…</p>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location, workspace: slug }} />
  }

  if (targetWorkspace && !authorizedRoles.includes(targetWorkspace.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Panel className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
            <ShieldAlert size={18} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-h3 text-ink">Access denied</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            You don't have permission to access the {targetWorkspace.label} workspace.
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

  // If accessing admin workspace while in another workspace, prompt for admin password
  if (slug === 'admin' && currentWorkspace?.slug !== 'admin') {
    const handleVerify = async (e) => {
      e.preventDefault()
      if (!password) return
      setVerifying(true)
      setError('')
      try {
        await signIn(user.email, password, 'admin')
      } catch (err) {
        setError(err.message || 'Incorrect password.')
      } finally {
        setVerifying(false)
      }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <Panel className="w-full max-w-md p-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
            <ShieldCheck size={20} strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-h3 text-ink">Admin Password Required</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            Enter your admin password to switch to the Admin workspace.
          </p>

          <form onSubmit={handleVerify} className="mt-6 space-y-4 text-left">
            {error && (
              <div className="rounded-control border border-critical/30 bg-critical-wash px-3 py-2 text-tiny font-medium text-critical">
                {error}
              </div>
            )}
            <Field label="Admin Password" required>
              <input
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="control w-full"
              />
            </Field>
            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" variant="primary" loading={verifying} className="w-full">
                Verify & Enter Admin
              </Button>
              <ButtonLink to={home} variant="ghost" size="sm" className="w-full text-center">
                Return to {currentWorkspace?.label || 'workspace'}
              </ButtonLink>
            </div>
          </form>
        </Panel>
      </div>
    )
  }

  return <Outlet />
}
