import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { adminService } from '@/services'
import { useToast } from '@/lib/toast'
import { ROLES, ROLE_NAMES, ROLE_SUMMARY } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

/**
 * Change someone's role.
 *
 * A role change silently rewrites what a person can reach, so the dialog
 * states the before and after explicitly and names the consequence before the
 * button is available. It is a small amount of friction in front of the single
 * most consequential action in the admin surface.
 */
export function RoleChangeModal({ open, onClose, onSaved, user }) {
  const toast = useToast()
  const [role, setRole] = useState(user?.role || 'site_engineer')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setRole(user?.role || 'site_engineer')
      setReason('')
    }
  }, [open, user])

  if (!user) return null

  const changed = role !== user.role
  const toAdmin = role === 'admin' && user.role !== 'admin'

  const submit = async () => {
    if (!changed) return onClose()
    setSaving(true)
    try {
      await adminService.users.changeRole(user.id, role, reason.trim() || undefined)
      toast.success(`${user.name} is now a ${ROLE_NAMES[role].toLowerCase()}.`)
      onSaved?.()
      onClose()
    } catch (error) {
      // 409 is the lockout guard: the last admin cannot be demoted.
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change role"
      description={user.name}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!changed}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-raised px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-micro text-subtle">Current role</p>
          <p className="mt-0.5 text-base font-medium text-ink">{ROLE_NAMES[user.role]}</p>
        </div>
        <ArrowRight size={15} className="shrink-0 text-subtle" />
        <div className="min-w-0">
          <p className="text-micro text-subtle">New role</p>
          <p className="mt-0.5 text-base font-medium text-ink">
            {changed ? ROLE_NAMES[role] : '—'}
          </p>
        </div>
      </div>

      <Field label="Change to" className="mt-4" hint={ROLE_SUMMARY[role]}>
        <Select value={role} onChange={(event) => setRole(event.target.value)}>
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {ROLE_NAMES[value]}
              {value === user.role ? ' (current)' : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Reason"
        className="mt-4"
        hint="Optional. Recorded in the activity log beside the change."
      >
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Covering for Meera while she is on leave"
          maxLength={280}
        />
      </Field>

      {changed && (
        <div className="mt-4 flex items-start gap-3 rounded-panel border border-amber/30 bg-amber-wash p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-deep" />
          <div>
            <p className="text-tiny font-medium text-amber-deep">
              This changes what {user.name.split(' ')[0]} can access.
            </p>
            <p className="mt-1 text-tiny leading-relaxed text-muted">
              Changing this user's role will modify the sections and actions they can
              reach. It applies on their very next request, even if they are signed in
              right now.
              {toAdmin && ' An administrator can manage every project, user and role on the platform.'}
            </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
