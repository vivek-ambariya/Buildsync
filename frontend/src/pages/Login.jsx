import { useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'

import { homeFor, useAuth } from '@/lib/auth'
import { workspaceForSlug } from '@/lib/workspaces'
import { gsap, prefersReducedMotion } from '@/animations'
import { Logo } from '@/components/Logo'
import { WorkspaceChooser } from '@/features/auth/WorkspaceChooser'
import { WorkspaceLogin } from '@/features/auth/WorkspaceLogin'

/**
 * Signing in, in two steps: choose a workspace, then authenticate into it.
 *
 * Both steps live in one route so moving between them is a transition rather
 * than a navigation — nothing reloads, and "change workspace" costs a click.
 * The chosen workspace is sent with the credentials and validated server-side;
 * choosing "Admin" asks for the admin workspace, it does not confer it.
 */
export default function Login() {
  const { signIn, status, home } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // A deep link that bounced to /login remembers which workspace it wanted.
  const intended = location.state?.workspace
  const [selected, setSelected] = useState(() => workspaceForSlug(intended) || null)
  const panel = useRef(null)

  useLayoutEffect(() => {
    if (!panel.current || prefersReducedMotion()) return
    gsap.fromTo(
      panel.current,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
    )
  }, [selected])

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || home} replace />
  }

  const submit = async (email, password) => {
    const user = await signIn(email, password, selected.slug)
    const from = location.state?.from?.pathname
    // Only honour the remembered destination if this workspace can open it.
    const target = from && from.startsWith(homeFor(user?.role)) ? from : homeFor(user?.role)
    navigate(target, { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="flex shrink-0 items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" className="inline-flex">
          <Logo size={28} />
        </Link>
        {selected && (
          <span className="text-tiny text-subtle">
            Step 2 of 2 · <span className="text-muted">Sign in</span>
          </span>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
        <div ref={panel} className="w-full">
          {selected ? (
            <div className="flex justify-center">
              <WorkspaceLogin
                workspace={selected}
                onBack={() => setSelected(null)}
                onSubmit={submit}
              />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl text-center">
              <h1 className="font-display text-h1 leading-[1.1] text-ink">
                Welcome to BuildSync
              </h1>
              <p className="mx-auto mt-3 max-w-md text-lead text-muted">
                Choose the workspace you want to access.
              </p>

              <div className="mt-10 text-left">
                <WorkspaceChooser onSelect={setSelected} />
              </div>

              <p className="mt-8 text-tiny text-subtle">
                Your account decides which workspaces you can open. Selecting one here
                does not grant access to it.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
