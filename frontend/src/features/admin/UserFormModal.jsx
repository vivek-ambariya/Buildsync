import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'

import { adminService } from '@/services'
import { cn } from '@/lib/cn'
import { useToast } from '@/lib/toast'
import { ROLES, ROLE_NAMES, ROLE_SUMMARY } from '@/lib/permissions'
import { Button } from '@/components/ui/Button'
import { Field, FieldRow, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const BLANK = {
  name: '', email: '', role: 'site_engineer', title: '', phone: '',
  active: true, password: '', project_ids: [],
}

/**
 * Create or edit an account.
 *
 * Validation runs here so a mistake is caught before a round trip, but the
 * API validates the same things again — this is a courtesy to the person
 * filling the form, not the rule being enforced.
 */
export function UserFormModal({ open, onClose, onSaved, user, projects = [] }) {
  const editing = Boolean(user)
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [issued, setIssued] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setIssued(null)
    setCopied(false)
    setForm(
      user
        ? {
            name: user.name || '', email: user.email || '', role: user.role || 'site_engineer',
            title: user.title || '', phone: user.phone || '', active: user.active !== false,
            password: '',
            project_ids: (user.projects || []).map((p) => p.id),
          }
        : BLANK,
    )
  }, [open, user])

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const toggleProject = (id) =>
    setForm((current) => ({
      ...current,
      project_ids: current.project_ids.includes(id)
        ? current.project_ids.filter((value) => value !== id)
        : [...current.project_ids, id],
    }))

  const validate = () => {
    const found = {}
    if (form.name.trim().split(/\s+/).join(' ').length < 2) {
      found.name = "Enter the person's full name."
    }
    if (!EMAIL.test(form.email.trim())) found.email = 'Enter a valid email address.'
    if (!ROLES.includes(form.role)) found.role = 'Choose a role.'
    if (form.password && form.password.length < 8) {
      found.password = 'A password must be at least 8 characters.'
    }
    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        title: form.title.trim() || null,
        phone: form.phone.trim() || null,
        active: form.active,
        project_ids: form.project_ids,
      }
      if (editing) {
        await adminService.users.update(user.id, body)
        toast.success(`${body.name} updated.`)
        onSaved?.()
        onClose()
      } else {
        const result = await adminService.users.create({
          ...body,
          password: form.password || undefined,
        })
        onSaved?.()
        if (result.temporary_password) {
          // Shown once. Keep the dialog open so it can be passed on.
          setIssued(result.temporary_password)
          toast.success(`${body.name} added.`)
        } else {
          toast.success(`${body.name} added.`)
          onClose()
        }
      }
    } catch (error) {
      if (error.status === 403) {
        toast.error('Your role cannot manage accounts.')
      } else if (error.status === 409) {
        setErrors({ email: error.message })
      } else if (error.status === 422) {
        toast.error(error.message)
      } else {
        toast.error(error.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.info('Copy it manually — the clipboard is unavailable here.')
    }
  }

  // After creating an account with a generated password, the dialog turns into
  // a hand-off screen. The password is not retrievable later.
  if (issued) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Account created"
        description="Pass this password on now — it cannot be shown again."
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="flex items-start gap-3 rounded-panel border border-amber/30 bg-amber-wash p-4">
          <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-deep" />
          <div className="min-w-0">
            <p className="text-tiny font-medium text-amber-deep">One-time password</p>
            <p className="mt-1.5 break-all font-mono text-body text-ink">{issued}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={copy} className="mt-4 w-full">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy password'}
        </Button>
        <p className="mt-3 text-tiny leading-relaxed text-subtle">
          Only a hash of this password is stored, so nobody — including you — can read it
          back. If it is lost, issue a new one from the account's actions.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${user.name}` : 'Add user'}
      description={
        editing
          ? 'Changes take effect the next time they load a page.'
          : 'They will be able to sign in as soon as the account is created.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} type="submit">
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <FieldRow>
          <Field label="Full name" required error={errors.name}>
            <Input
              value={form.name}
              onChange={set('name')}
              placeholder="Rahul Shah"
              autoComplete="off"
            />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="rahul.shah@buildsync.ai"
              autoComplete="off"
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Role" required error={errors.role} hint={ROLE_SUMMARY[form.role]}>
            <Select value={form.role} onChange={set('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_NAMES[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Job title" hint="Shown in the team directory.">
            <Input value={form.title} onChange={set('title')} placeholder="Site Engineer, Structures" />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} placeholder="+91 98250 41207" />
          </Field>
          <Field label="Status" hint={form.active ? 'They can sign in.' : 'Sign-in is blocked.'}>
            <Select value={form.active ? 'active' : 'inactive'}
                    onChange={(event) => setForm((c) => ({ ...c, active: event.target.value === 'active' }))}>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </Select>
          </Field>
        </FieldRow>

        {!editing && (
          <Field
            label="Password"
            error={errors.password}
            hint="Leave this empty and BuildSync will issue a one-time password for you."
          >
            <Input
              type="text"
              value={form.password}
              onChange={set('password')}
              placeholder="Generated automatically"
              autoComplete="new-password"
            />
          </Field>
        )}

        <div>
          <span className="field-label mb-1.5 block">Project assignment</span>
          {projects.length === 0 ? (
            <p className="rounded-control border border-line bg-raised px-3 py-2.5 text-tiny text-subtle">
              There are no projects to assign yet.
            </p>
          ) : (
            <>
              <div className="max-h-44 overflow-y-auto rounded-control border border-line">
                {projects.map((project) => {
                  const checked = form.project_ids.includes(project.id)
                  return (
                    <label
                      key={project.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2.5 last:border-b-0',
                        'transition-colors duration-150 hover:bg-raised',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProject(project.id)}
                        className="h-3.5 w-3.5 shrink-0 accent-current text-ink"
                      />
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{project.name}</span>
                      <span className="shrink-0 text-micro text-subtle">{project.code}</span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-1.5 text-tiny text-subtle">
                {form.project_ids.length} of {projects.length} selected. This controls which
                projects they can see at all.
              </p>
            </>
          )}
        </div>
      </form>
    </Modal>
  )
}
