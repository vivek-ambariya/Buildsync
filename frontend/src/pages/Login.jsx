import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { workspaceForSlug } from '@/lib/workspaces'
import { AuthShell } from '@/features/auth/AuthShell'
import { DemoAccounts } from '@/features/auth/DemoAccounts'
import { SignIn1, SignInSocialProof } from '@/components/ui/modern-stunning-sign-in'

/**
 * Signing in: one card, one step.
 *
 * Which workspace opens is decided by the account, not by the form. That is
 * why nothing here asks: an account with one workspace has no choice to make,
 * and an account with several lands in its primary one and moves with the
 * switcher in a click. The only time a workspace is named on this page is
 * when a deep link bounced here on the way to one, and then it is shown so
 * the person can see where they are being sent — and dismiss it if they
 * would rather just sign in.
 */
export default function Login() {
  const { signIn, status, home } = useAuth()
  const location = useLocation()

  const [intended, setIntended] = useState(() =>
    workspaceForSlug(location.state?.workspace),
  )
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [prefill, setPrefill] = useState(null)

  const fill = useCallback((email, password) => {
    setError(null)
    // A fresh object each time, so picking the same account twice still fills.
    setPrefill({ email, password })
  }, [])

  // The one place that decides where a signed-in person goes, so that
  // arriving here with a session and arriving here by signing in cannot
  // disagree. The remembered destination is honoured only when this account's
  // workspace can actually open it — otherwise a deep link to somebody else's
  // workspace would answer a correct password with "Access denied".
  if (status === 'authenticated') {
    const from = location.state?.from?.pathname
    return <Navigate to={from && from.startsWith(home) ? from : home} replace />
  }

  const submit = async ({ email, password }) => {
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password, intended?.slug)
      // No navigation here: the branch above redirects on the next render,
      // once the session — and with it the right destination — actually exists.
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      aside={
        <span className="text-tiny text-subtle">
          New to BuildSync?{' '}
          <Link to="/signup" className="link-quiet font-medium">
            Create an account
          </Link>
        </span>
      }
    >
      <SignIn1
        title="Sign in to BuildSync"
        subtitle="Your account decides which workspace opens."
        error={error}
        submitting={submitting}
        onSubmit={submit}
        prefill={prefill}
        eyebrow={
          intended && (
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-amber/30 bg-amber-wash py-1 pl-2.5 pr-1.5 text-micro font-medium text-amber-deep">
              <intended.icon size={12} strokeWidth={2} />
              Continuing to {intended.label}
              <button
                type="button"
                onClick={() => setIntended(null)}
                aria-label="Don't continue to that workspace"
                className="rounded-full p-0.5 transition-colors hover:bg-amber/20"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          )
        }
        footer={
          <>
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-ink underline underline-offset-2">
              Sign up, it&apos;s free
            </Link>
          </>
        }
      />

      <div className="mt-8 flex w-full flex-col items-center gap-8">
        <DemoAccounts onPick={fill} selectedEmail={prefill?.email} />
        <SignInSocialProof />
      </div>
    </AuthShell>
  )
}
