import { Link } from 'react-router-dom'

import { Logo } from '@/components/Logo'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'

/**
 * The wordmark, as a way back to the start.
 *
 * Signed out it returns to the landing page. Signed in it returns to whichever
 * surface the person's role actually works from — the same `home` the auth
 * context already hands to sign-in and every other "back to the start" path,
 * so a site manager lands in the field app rather than on a portfolio
 * dashboard full of figures they cannot act on.
 *
 * Only navigation chrome should use this. The mark on a loading screen or
 * beside a chat message stays a plain Logo: a link that goes nowhere useful is
 * worse than no link at all.
 */
export function LogoLink({ size, className, showWordmark, subtitle }) {
  const { status, home } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <Link
      to={signedIn ? home : '/'}
      aria-label={signedIn ? 'BuildSync AI — back to your dashboard' : 'BuildSync AI — back to the home page'}
      className={cn('inline-flex rounded-control transition-opacity hover:opacity-70', className)}
    >
      <Logo size={size} showWordmark={showWordmark} subtitle={subtitle} />
    </Link>
  )
}
