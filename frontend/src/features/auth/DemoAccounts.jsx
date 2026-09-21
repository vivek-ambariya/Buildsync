import { useEffect, useState } from 'react'

import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { ROLE_LABELS } from '@/lib/auth'

/**
 * The seeded accounts, offered one click away.
 *
 * Local development only, and it renders nothing at all when the API has no
 * demo accounts to give — so a deployment without them shows a plain sign-in
 * card rather than an empty panel explaining its own absence.
 */
export function DemoAccounts({ onPick, selectedEmail }) {
  const [accounts, setAccounts] = useState([])

  useEffect(() => {
    let cancelled = false
    api.auth
      .demoAccounts()
      .then((data) => {
        if (!cancelled) setAccounts(data.accounts || [])
      })
      .catch(() => setAccounts([]))
    return () => {
      cancelled = true
    }
  }, [])

  if (accounts.length === 0) return null

  return (
    <div className="w-full max-w-sm">
      <p className="text-tiny font-medium text-muted">Demo accounts</p>
      <div className="mt-2.5 grid gap-1.5">
        {accounts.map((account) => (
          <button
            key={account.id}
            type="button"
            onClick={() => onPick(account.email, 'buildsync')}
            className={cn(
              'flex items-center justify-between gap-3 rounded-control border px-3 py-2 text-left',
              'transition-colors duration-150',
              selectedEmail === account.email
                ? 'border-line-strong bg-raised'
                : 'border-line bg-surface hover:border-line-strong hover:bg-raised',
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-tiny font-medium text-ink">
                {account.name}
              </span>
              <span className="block truncate text-micro text-muted">{account.email}</span>
            </span>
            <span className="shrink-0 rounded-pill border border-line bg-paper px-2 py-0.5 text-micro text-subtle">
              {ROLE_LABELS[account.role] || account.role}
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-micro text-subtle">
        Local development only. Every demo account uses the password{' '}
        <span className="text-muted">buildsync</span>.
      </p>
    </div>
  )
}
