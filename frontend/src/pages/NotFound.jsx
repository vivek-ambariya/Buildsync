import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/Logo'
import { LogoLink } from '@/components/LogoLink'

export default function NotFound({ standalone = false }) {
  const content = (
    <div className="flex flex-col items-center text-center">
      <p className="font-display text-h1 tabular text-line-strong">404</p>
      <h1 className="mt-2 font-display text-h3 text-ink">This page does not exist</h1>
      <p className="mt-2 max-w-sm text-body text-muted">
        The link may be out of date, or the project it pointed to has been removed.
      </p>
      <Button variant="primary" className="mt-6" onClick={() => window.history.back()}>
        Go back
      </Button>
      <Link to="/app" className="link-quiet mt-4 text-base">
        Open the dashboard
      </Link>
    </div>
  )

  if (!standalone) return <div className="flex min-h-[60vh] items-center justify-center">{content}</div>

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-paper px-6">
      <LogoLink size={30} />
      {content}
    </div>
  )
}
