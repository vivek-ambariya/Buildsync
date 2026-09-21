import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/cn'
import { gsap, prefersReducedMotion } from '@/animations'
import { LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'

/**
 * The single card the whole product is entered through.
 *
 * One component serves both doors because they are the same act with one
 * field's difference, and a sign-up that looks like a different product is a
 * sign-up people abandon. `mode` decides which: 'signin' asks for an email
 * and a password, 'signup' also asks who you are and which workspace you are
 * here for.
 *
 * It validates what it can see and nothing more. An address that is not an
 * address, or a password too short to be accepted, is worth catching here
 * because the answer is instant and costs no round trip. Everything that
 * depends on state this component cannot know — whether the address is
 * already taken, whether the password is right — is the server's to answer,
 * and arrives back through `error`.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD = 8

const validateEmail = (email) => EMAIL.test(email)

export function SignIn1({
  mode = 'signin',
  title,
  subtitle,
  /** A message from the server — wrong password, address already taken. */
  error,
  submitting = false,
  /** Called with the trimmed values once the form validates locally. */
  onSubmit,
  /** Offered on sign-up only: the workspaces an account may be opened in. */
  roles = [],
  /** Small block above the title, e.g. the workspace a deep link remembered. */
  eyebrow,
  /**
   * Credentials supplied from outside — the demo-account shortcuts use it.
   * A new object means "put these in the fields now"; both stay editable
   * afterwards, so this fills the form rather than taking it over.
   */
  prefill,
  /** The line under the card: "Don't have an account?" and its counterpart. */
  footer,
  className,
}) {
  const signup = mode === 'signup'
  const scope = useRef(null)
  const alertRef = useRef(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(roles[0]?.value || '')
  const [localError, setLocalError] = useState('')

  const shown = localError || error

  useEffect(() => {
    if (!prefill) return
    if (prefill.email !== undefined) setEmail(prefill.email)
    if (prefill.password !== undefined) setPassword(prefill.password)
    setLocalError('')
  }, [prefill])

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
      { opacity: 1, y: 0, duration: 0.34, ease: 'power3.out', stagger: 0.04 },
    )
    return () => tween.kill()
  }, [mode])

  // An error that simply appears can be missed; one that arrives is noticed.
  useLayoutEffect(() => {
    if (shown && alertRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        alertRef.current,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' },
      )
    }
  }, [shown])

  const submit = async (event) => {
    event.preventDefault()

    const trimmedName = name.trim().replace(/\s+/g, ' ')
    const trimmedEmail = email.trim()

    if (signup && trimmedName.length < 2) {
      setLocalError('Enter your full name.')
      return
    }
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both email and password.')
      return
    }
    if (!validateEmail(trimmedEmail)) {
      setLocalError('Please enter a valid email address.')
      return
    }
    if (signup && password.length < MIN_PASSWORD) {
      setLocalError(`Choose a password of at least ${MIN_PASSWORD} characters.`)
      return
    }

    setLocalError('')
    await onSubmit?.({
      name: trimmedName,
      email: trimmedEmail,
      password,
      role: signup ? role : undefined,
    })
  }

  return (
    <div
      ref={scope}
      className={cn('flex w-full flex-col items-center', className)}
    >
      <div
        data-step
        className={cn(
          'relative w-full max-w-sm overflow-hidden rounded-panel border border-line bg-surface',
          'p-7 shadow-overlay sm:p-8',
        )}
      >
        {/* The amber rule along the top edge, the way a level line is chalked
            onto a wall — the one mark that says which product this is. */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-amber" />

        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-panel border border-line bg-raised">
            <LogoMark size={26} />
          </span>

          {eyebrow && <div className="mt-4">{eyebrow}</div>}

          <h1 className="mt-4 font-display text-h3 text-ink">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-base leading-relaxed text-muted">{subtitle}</p>
          )}
        </div>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3.5">
          {signup && (
            <div data-step>
              <Field label="Full name" required>
                <Input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Priya Sharma"
                  required
                />
              </Field>
            </div>
          )}

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
            <Field
              label="Password"
              required
              hint={signup ? `At least ${MIN_PASSWORD} characters.` : undefined}
            >
              <Input
                type="password"
                name="password"
                autoComplete={signup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={signup ? MIN_PASSWORD : 6}
                required
              />
            </Field>
          </div>

          {signup && roles.length > 0 && (
            <div data-step>
              <Field
                label="Workspace"
                hint="An administrator can move you to another one later."
              >
                <Select
                  name="role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {roles.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {shown && (
            <div
              ref={alertRef}
              role="alert"
              className="flex items-start gap-2.5 rounded-control border border-critical/25 bg-critical-wash px-3.5 py-3"
            >
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-critical" />
              <p className="text-base leading-relaxed text-critical">{shown}</p>
            </div>
          )}

          <hr className="my-1 border-line" />

          <div data-step>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="w-full"
            >
              {submitting
                ? signup
                  ? 'Creating account'
                  : 'Signing in'
                : signup
                  ? 'Create account'
                  : 'Sign in'}
              {!submitting && <ArrowRight size={15} />}
            </Button>
          </div>

          {footer && (
            <div className="mt-1 text-center text-tiny text-subtle">{footer}</div>
          )}
        </form>
      </div>
    </div>
  )
}

/**
 * The line of faces under the card.
 *
 * Kept small and kept honest: it says who else is here, which is the one
 * thing a stranger on a sign-up page actually wants to know.
 */
export function SignInSocialProof({ className }) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <p className="max-w-xs text-tiny leading-relaxed text-subtle">
        Join the site teams already running their projects on{' '}
        <span className="font-medium text-muted">BuildSync</span>.
      </p>
      <div className="mt-3 flex -space-x-2">
        {FACES.map((face) => (
          <img
            key={face.src}
            src={face.src}
            alt=""
            loading="lazy"
            width={32}
            height={32}
            className="h-8 w-8 rounded-full border-2 border-paper object-cover"
          />
        ))}
      </div>
    </div>
  )
}

const FACES = [
  { src: unsplash('photo-1472099645785-5658abf4ff4e') },
  { src: unsplash('photo-1494790108377-be9c29b29330') },
  { src: unsplash('photo-1507003211169-0a1dd7228f2d') },
  { src: unsplash('photo-1438761681033-6461ffad8d80') },
]

function unsplash(id) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=64&h=64&q=70`
}

export default SignIn1
