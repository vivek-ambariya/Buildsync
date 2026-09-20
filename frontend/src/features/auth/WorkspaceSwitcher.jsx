import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

/**
 * Moves an account between the workspaces it holds.
 *
 * Renders nothing for the great majority of people, who hold one. For those
 * who hold more, switching exchanges the session for a new one that the
 * server has re-authorised — it is a second sign-in without the password, not
 * a client-side change of mode.
 */
export function WorkspaceSwitcher({ onDone, className }) {
  const { workspace, authorizedWorkspaces, switchWorkspace } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [switching, setSwitching] = useState(null)

  if (authorizedWorkspaces.length < 2) return null

  const go = async (target) => {
    if (target.slug === workspace?.slug) return onDone?.()
    setSwitching(target.slug)
    try {
      const user = await switchWorkspace(target.slug)
      toast.success(`Switched to ${target.label}.`, user?.name)
      navigate(target.base, { replace: true })
      onDone?.()
    } catch (error) {
      toast.error(error.message)
    } finally {
      setSwitching(null)
    }
  }

  return (
    <div className={cn('border-t border-line py-1.5', className)}>
      <p className="px-3.5 pb-1 pt-1.5 text-micro font-medium text-subtle">Switch workspace</p>
      {authorizedWorkspaces.map((target) => {
        const active = target.slug === workspace?.slug
        return (
          <button
            key={target.slug}
            type="button"
            disabled={Boolean(switching)}
            onClick={() => go(target)}
            className={cn(
              'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-base transition-colors duration-150',
              'disabled:opacity-60',
              active ? 'font-medium text-ink' : 'text-muted hover:bg-raised hover:text-ink',
            )}
          >
            <target.icon size={14} className={cn('shrink-0', active && 'text-amber-deep')} />
            <span className="flex-1 truncate">{target.label}</span>
            {switching === target.slug ? (
              <Loader2 size={13} className="shrink-0 animate-spin text-subtle" />
            ) : active ? (
              <Check size={13} className="shrink-0 text-amber-deep" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
