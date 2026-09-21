import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '@/lib/auth'
import { WORKSPACE_LIST } from '@/lib/workspaces'
import { AuthShell } from '@/features/auth/AuthShell'
import { SignIn1, SignInSocialProof } from '@/components/ui/modern-stunning-sign-in'

/**
 * Creating an account.
 *
 * The workspaces on offer are the three that a person can reasonably claim
 * for themselves, least access first — Admin is not among them, and asking
 * for it here is refused by the API rather than quietly granted or quietly
 * downgraded. Everything else about a new account — job title, projects,
 * a second workspace — is administration, and belongs to an administrator.
 */
const SELF_SIGNUP_ORDER = ['contractor', 'site-manager', 'project-manager']

const ROLE_OPTIONS = SELF_SIGNUP_ORDER.map((slug) => {
  const workspace = WORKSPACE_LIST.find((w) => w.slug === slug)
  return { value: workspace.role, label: workspace.label }
})

export default function Signup() {
  const { signUp, status, home } = useAuth()
  const location = useLocation()

  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to={home} replace />
  }

  const submit = async ({ name, email, password, role }) => {
    setError(null)
    setSubmitting(true)
    try {
      await signUp({ name, email, password, role })
      // The branch above sends the new account to its workspace on the next
      // render, so there is one redirect rule rather than two to keep in step.
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      aside={
        <span className="text-tiny text-subtle">
          Already have an account?{' '}
          <Link to="/login" className="link-quiet font-medium">
            Sign in
          </Link>
        </span>
      }
    >
      <SignIn1
        mode="signup"
        title="Create your account"
        subtitle="One workspace to start. An administrator can widen it later."
        roles={ROLE_OPTIONS}
        error={error}
        submitting={submitting}
        onSubmit={submit}
        footer={
          <>
            Already have an account?{' '}
            <Link
              to="/login"
              state={location.state}
              className="font-medium text-ink underline underline-offset-2"
            >
              Sign in
            </Link>
          </>
        }
      />

      <SignInSocialProof className="mt-8" />
    </AuthShell>
  )
}
