import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'

/**
 * Step two: sign in to the workspace that was chosen.
 *
 * The workspace stays named above the form the whole way through, because the
 * commonest mistake here is not a typo — it is arriving at the wrong door.
 * Changing it costs one click and loses nothing that was typed.
 */
export function WorkspaceLogin({ workspace, onBack, onSubmit }) {
  const scope = useRef(null)
  const errorRef = useRef(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    let cancelled = false
    api.auth
      .demoAccounts()
      .then((data) => {
        if (cancelled) return
        // Only the accounts that can actually open this workspace.
        setAccounts(
          (data.accounts || []).filter((a) =>
            (a.authorized_roles || [a.role]).includes(workspace.role),
          ),
        )
      })
      .catch(() => setAccounts([]))
    return () => {
      cancelled = true
    }
  }, [workspace.role])

  useLayoutEffect(() => {
    const items = scope.current?.querySelectorAll('[data-step]')
    if (!items?.length) return undefined
    if (prefersReducedMotion()) {
      gsap.set(items, { opacity: 1, y: 0 })
      return undefined
    }
    const tween = gsap.fromTo(
      items,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out', stagger: 0.045 },
    )
    return () => tween.kill()
  }, [workspace.slug])

  // An error that simply appears can be missed; one that arrives is noticed.
  useLayoutEffect(() => {
    if (error && errorRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        errorRef.current,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' },
      )
    }
  }, [error])

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(email.trim(), password)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div ref={scope} className="w-full max-w-sm">
      <button
        type="button"
        onClick={onBack}
        data-step
        className="group mb-6 inline-flex items-center gap-1.5 text-tiny font-medium text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
        Change workspace
      </button>

      <div data-step className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-panel border border-amber/30 bg-amber-wash text-amber-deep">
          <workspace.icon size={17} strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-micro font-medium uppercase tracking-[0.08em] text-amber-deep">
            {workspace.label}
          </p>
          <p className="text-micro text-subtle">Selected workspace</p>
        </div>
      </div>

      <h1 data-step className="mt-5 font-display text-h2 text-ink">
        {workspace.loginTitle}
      </h1>
      <p data-step className="mt-2 text-body text-muted">
        {workspace.loginSubtitle}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-3.5">
        <div data-step>
          <Field label="Work email" required>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
            />
          </Field>
        </div>

        <div data-step>
          <Field label="Password" required>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </Field>
        </div>

        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="flex items-start gap-2.5 rounded-control border border-critical/25 bg-critical-wash px-3.5 py-3"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
            <div>
              <p className="text-base leading-relaxed text-critical">{error}</p>
              <button
                type="button"
                onClick={onBack}
                className="mt-1.5 text-tiny font-medium text-critical underline underline-offset-2"
              >
                Choose a different workspace
              </button>
            </div>
          </div>
        )}

        <div data-step>
          <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
            {submitting ? 'Signing in' : 'Sign in'}
            {!submitting && <ArrowRight size={15} />}
          </Button>
        </div>
      </form>

      {accounts.length > 0 && (
        <div className="mt-7 border-t border-line pt-5" data-step>
          <p className="text-tiny font-medium text-muted">
            Demo accounts for this workspace
          </p>
          <div className="mt-2.5 grid gap-1.5">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  setPassword('buildsync')
                  setError(null)
                }}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-left',
                  'transition-colors duration-150',
                  email === account.email
                    ? 'border-line-strong bg-raised'
                    : 'border-line hover:border-line-strong hover:bg-raised',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-tiny font-medium text-ink">{account.name}</span>
                  <span className="block truncate text-micro text-muted">{account.email}</span>
                </span>
                {(account.authorized_roles || []).length > 1 && (
                  <span className="shrink-0 rounded-pill border border-line bg-surface px-2 py-0.5 text-micro text-subtle">
                    {account.authorized_roles.length} workspaces
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-micro text-subtle">
            Local development only. All demo accounts use the password{' '}
            <span className="text-muted">buildsync</span>.
          </p>
        </div>
      )}
    </div>
  )
}
