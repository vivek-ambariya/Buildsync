import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Form'

/**
 * Moves an account between the workspaces it holds.
 *
 * Switching to Admin from another workspace requires entering the Admin password.
 * When in Admin mode, non-admin workspaces are hidden to keep Admin mode pure.
 */
export function WorkspaceSwitcher({ onDone, className }) {
  const { workspace, authorizedWorkspaces, switchWorkspace, signIn, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [switching, setSwitching] = useState(null)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  if (authorizedWorkspaces.length < 2) return null

  const go = async (target) => {
    if (target.slug === workspace?.slug) return onDone?.()

    if (target.slug === 'admin' && workspace?.slug !== 'admin') {
      setPassword('')
      setError('')
      setAdminModalOpen(true)
      return
    }

    setSwitching(target.slug)
    try {
      const u = await switchWorkspace(target.slug)
      toast.success(`Switched to ${target.label}.`, u?.name)
      navigate(target.base, { replace: true })
      onDone?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSwitching(null)
    }
  }

  const handleAdminVerify = async (e) => {
    e.preventDefault()
    if (!password) return
    setVerifying(true)
    setError('')
    try {
      const u = await signIn(user.email, password, 'admin')
      toast.success('Switched to Admin workspace.', u?.name)
      setAdminModalOpen(false)
      navigate('/admin', { replace: true })
      onDone?.()
    } catch (err) {
      setError(err.message || 'Incorrect password.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <>
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

      <Modal
        open={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        title="Admin Authentication Required"
        description="Enter your admin password to switch to the Admin workspace."
      >
        <form onSubmit={handleAdminVerify} className="space-y-4">
          {error && (
            <div className="rounded-control border border-critical/30 bg-critical-wash px-3 py-2 text-tiny font-medium text-critical">
              {error}
            </div>
          )}
          <Field label="Admin Password" required>
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="control w-full"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAdminModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={verifying}>
              Confirm & Enter Admin
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
