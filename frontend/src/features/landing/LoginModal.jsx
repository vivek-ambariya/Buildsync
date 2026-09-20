import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { LogoMark } from '@/components/Logo'

/**
 * Sign in without leaving the page. The visitor scrolled the whole story to
 * get here, so sending them to a separate route would throw that away.
 */
export function LoginModal({ open, onClose }) {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('vivek@buildsync.ai')
  const [password, setPassword] = useState('buildsync')
  const [remember, setRemember] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    api.auth
      .demoAccounts()
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
  }, [open])

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/app')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Sign in to BuildSync"
      description="Use a demo account below, or your own credentials."
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="mb-1 flex items-center gap-2.5 rounded-control border border-line bg-raised px-3 py-2.5">
          <LogoMark size={26} />
          <p className="text-tiny leading-snug text-muted">
            Eight live projects, ₹114 Cr under management, and 37 open risk findings are waiting inside.
          </p>
        </div>

        <Field label="Work email" required>
          <Input
            type="email"
            name="email"
            id="modal-email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />
        </Field>

        <Field label="Password" required>
          <Input
            type="password"
            name="password"
            id="modal-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </Field>

        <label className="flex cursor-pointer select-none items-center gap-2 text-base text-muted">
          <input
            type="checkbox"
            name="remember"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-line-strong accent-ink"
          />
          Keep me signed in
        </label>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-control border border-critical/25 bg-critical-wash px-3 py-2.5">
            <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
            <p className="text-base leading-relaxed text-critical">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
          {submitting ? 'Opening your dashboard' : 'Open the dashboard'}
          {!submitting && <ArrowRight size={15} />}
        </Button>

        {accounts.length > 0 && (
          <div className="border-t border-line pt-3.5">
            <p className="text-tiny font-medium text-muted">Sign in as</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {accounts.slice(0, 4).map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('buildsync')
                    setError(null)
                  }}
                  className={cn(
                    'rounded-control border px-2.5 py-1.5 text-left transition-colors duration-150',
                    email === account.email
                      ? 'border-line-strong bg-raised'
                      : 'border-line hover:border-line-strong hover:bg-raised',
                  )}
                >
                  <span className="block truncate text-tiny font-medium text-ink">{account.name}</span>
                  <span className="block truncate text-micro text-muted">
                    {account.role.replace(/_/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
