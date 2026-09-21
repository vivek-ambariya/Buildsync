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
 * Switching to any workspace requires entering the account password.
 */
export function WorkspaceSwitcher({ onDone, className }) {
  const { workspace, authorizedWorkspaces, switchWorkspace, user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [targetWorkspace, setTargetWorkspace] = useState(null)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')

  if (!authorizedWorkspaces || authorizedWorkspaces.length < 2) return null

  const openPasswordPrompt = (target) => {
    if (target.slug === workspace?.slug) return onDone?.()
    setTargetWorkspace(target)
    setPassword('')
    setError('')
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!password || !targetWorkspace) return
    setVerifying(true)
    setError('')
    try {
      const u = await switchWorkspace(targetWorkspace.slug, password)
      toast.success(`Switched to ${targetWorkspace.label} workspace.`, u?.name)
      setTargetWorkspace(null)
      navigate(targetWorkspace.base, { replace: true })
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
              disabled={Boolean(verifying)}
              onClick={() => openPasswordPrompt(target)}
              className={cn(
                'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-base transition-colors duration-150',
                'disabled:opacity-60',
                active ? 'font-medium text-ink' : 'text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <target.icon size={14} className={cn('shrink-0', active && 'text-amber-deep')} />
              <span className="flex-1 truncate">{target.label}</span>
              {active ? <Check size={13} className="shrink-0 text-amber-deep" /> : null}
            </button>
          )
        })}
      </div>

      <Modal
        open={Boolean(targetWorkspace)}
        onClose={() => setTargetWorkspace(null)}
        title={`Switch to ${targetWorkspace?.label || ''} Workspace`}
        description={`Enter your password to access the ${targetWorkspace?.label || ''} workspace.`}
      >
        <form onSubmit={handleVerify} className="space-y-4">
          {error && (
            <div className="rounded-control border border-critical/30 bg-critical-wash px-3 py-2 text-tiny font-medium text-critical">
              {error}
            </div>
          )}
          <Field label="Account Password" required>
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
            <Button type="button" variant="ghost" onClick={() => setTargetWorkspace(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={verifying}>
              Confirm & Switch
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}
