import { useCallback, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { AuthShell } from '@/features/auth/AuthShell'
import { DemoAccounts } from '@/features/auth/DemoAccounts'
import { SignIn1, SignInSocialProof } from '@/components/ui/modern-stunning-sign-in'

/**
 * Signing in: one card, one step.
 *
 * Which workspace opens is decided by the account, not by the form. An
 * account is one role, so there is no choice to offer on the way in and none
 * to change afterwards — an administrator signs in and is in the admin
 * workspace, and reaching another one means signing in to another account.
 */
export default function Login() {
  const { signIn, status, home } = useAuth()
  const location = useLocation()

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
      await signIn(email, password)
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
