import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { useEnter } from '@/animations/useMotion'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Logo } from '@/components/Logo'

export default function Login() {
  const { signIn, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const scope = useEnter([])

  const [email, setEmail] = useState('vivek@buildsync.ai')
  const [password, setPassword] = useState('buildsync')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    api.auth
      .demoAccounts()
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
  }, [])

  if (status === 'authenticated') {
    return <Navigate to={location.state?.from?.pathname || '/app'} replace />
  }

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from?.pathname || '/app', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const useAccount = (account) => {
    setEmail(account.email)
    setPassword('buildsync')
    setError(null)
  }

  return (
    <div ref={scope} className="flex min-h-screen bg-paper">
      {/* Left: the form. Right: what the product is for. */}
      <div className="flex w-full flex-col px-6 py-8 sm:px-10 lg:w-[46%] lg:px-14">
        <Link to="/" className="inline-flex" data-enter>
          <Logo size={28} />
        </Link>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-h2 text-ink" data-enter>
              Sign in
            </h1>
            <p className="mt-2 text-body text-muted" data-enter>
              Your projects, site reports, budgets and risk findings, in one place.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-3.5">
              <div data-enter>
                <Field label="Work email" required>
                  <Input
                    type="email"
                    name="email"
                    id="login-email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </Field>
              </div>

              <div data-enter>
                <Field label="Password" required>
                  <Input
                    type="password"
                    name="password"
                    id="login-password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between" data-enter>
                <label className="flex cursor-pointer select-none items-center gap-2 text-base text-muted">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-line-strong text-ink accent-ink"
                  />
                  Keep me signed in
                </label>
                <button
                  type="button"
                  onClick={() => setError('Password resets are handled by your administrator. Ask them to issue a new one.')}
                  className="text-base text-muted transition-colors hover:text-ink"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-control border border-critical/25 bg-critical-wash px-3.5 py-3"
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
                  <p className="text-base leading-relaxed text-critical">{error}</p>
                </div>
              )}

              <div data-enter>
                <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
                  {submitting ? 'Signing in' : 'Sign in'}
                  {!submitting && <ArrowRight size={15} />}
                </Button>
              </div>
            </form>

            {accounts.length > 0 && (
              <div className="mt-7 border-t border-line pt-5" data-enter>
                <p className="text-tiny font-medium text-muted">Or sign in as</p>
                <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                  {accounts.slice(0, 4).map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => useAccount(account)}
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
                        <span className="block truncate text-micro text-muted">
                          {account.role.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-micro text-subtle">
                  Demo accounts all use the password <span className="text-muted">buildsync</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The value proposition, stated as a live figure rather than a stock photo. */}
      <aside className="relative hidden flex-1 overflow-hidden border-l border-line bg-surface lg:block">
        <div className="survey-grid absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-14">
          <div>
            <p className="text-tiny font-medium text-muted">Construction intelligence</p>
            <p className="mt-4 max-w-md font-display text-h1 leading-[1.08] text-ink">
              Every delay leaves a trace in the data before it shows up on site.
            </p>
            <p className="mt-5 max-w-sm text-lead text-muted">
              BuildSync reads progress, spend and stock together, so a slipping
              foundation is a number on Monday, not a surprise in March.
            </p>
          </div>

          <dl className="grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-panel border border-line bg-line">
            <Stat label="Projects tracked" value="8" caption="live portfolio" />
            <Stat label="Risk findings" value="37" caption="ranked by impact" />
            <Stat label="Budget under management" value="₹114 Cr" caption="across 4 cities" />
          </dl>
        </div>
      </aside>
    </div>
  )
}

function Stat({ label, value, caption }) {
  return (
    <div className="bg-surface px-5 py-5">
      <dt className="text-micro text-subtle">{label}</dt>
      <dd className="mt-1.5 font-display text-h3 tabular text-ink">{value}</dd>
      <dd className="mt-0.5 text-micro text-subtle">{caption}</dd>
    </div>
  )
}
