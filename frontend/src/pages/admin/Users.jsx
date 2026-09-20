import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Ban, Check, CheckCircle2, Copy, Eye, KeyRound, Pencil, ShieldCheck, Trash2, UserPlus,
  Users as UsersIcon,
} from 'lucide-react'

import { adminService, projectService } from '@/services'
import { useAsync, useDebounced } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { relativeTime } from '@/lib/format'
import { ROLES, ROLE_NAMES } from '@/lib/permissions'
import { useToast } from '@/lib/toast'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AdminTable, AdminToolbar } from '@/features/admin/AdminTable'
import { RoleChangeModal } from '@/features/admin/RoleChangeModal'
import { UserDetailDrawer } from '@/features/admin/UserDetailDrawer'
import { UserFormModal } from '@/features/admin/UserFormModal'
import { RowMenu } from '@/features/admin/RowMenu'

const ROLE_STYLES = {
  admin: 'border-amber/35 bg-amber-wash text-amber-deep',
  project_manager: 'border-line-strong bg-raised text-ink',
  site_engineer: 'border-info/25 bg-info-wash text-info',
  contractor: 'border-line-strong bg-raised text-muted',
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 250)
  const role = params.get('role') || ''
  const status = params.get('status') || ''

  const setParam = (key) => (value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }

  const { data, error, loading, reload } = useAsync(
    () => adminService.users.list({ q: debounced || undefined, role: role || undefined, status: status || undefined }),
    [debounced, role, status],
  )
  const { data: projects } = useAsync(() => projectService.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [roleTarget, setRoleTarget] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState(null)

  const rows = data?.users
  const counts = data?.counts

  const act = async (label, run) => {
    setBusy(true)
    try {
      await run()
      toast.success(label)
      reload()
      setConfirm(null)
    } catch (err) {
      // 403 is the API refusing; 409 is a guard (last admin, or still owns work).
      toast.error(err.status === 403 ? 'Your role cannot manage accounts.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        value: (row) => row.name,
        render: (row) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={row.name} initials={row.avatar_initials} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-ink">{row.name}</span>
                {row.id === me?.id && (
                  <span className="shrink-0 rounded-pill border border-line bg-raised px-1.5 text-micro text-muted">
                    you
                  </span>
                )}
              </div>
              <span className="block truncate text-tiny text-subtle">{row.title || '—'}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        value: (row) => row.email,
        render: (row) => <span className="truncate text-muted">{row.email}</span>,
      },
      {
        key: 'role',
        header: 'Role',
        value: (row) => ROLE_NAMES[row.role] || row.role,
        render: (row) => (
          <span
            className={cn(
              'inline-flex items-center gap-1 whitespace-nowrap rounded-pill border px-2.5 py-1 text-tiny font-medium',
              ROLE_STYLES[row.role] || ROLE_STYLES.contractor,
            )}
          >
            {row.role === 'admin' && <ShieldCheck size={11} strokeWidth={2.2} />}
            {ROLE_NAMES[row.role] || row.role}
          </span>
        ),
      },
      {
        key: 'projects',
        header: 'Projects',
        align: 'right',
        sortValue: (row) => row.project_count,
        render: (row) => (
          <span className="tabular">
            <span className={row.project_count ? 'text-ink' : 'text-line-strong'}>
              {row.project_count}
            </span>
            {row.managed_count > 0 && (
              <span className="ml-1.5 text-micro text-subtle">({row.managed_count} led)</span>
            )}
          </span>
        ),
      },
      {
        key: 'active',
        header: 'Status',
        value: (row) => (row.active ? 'Active' : 'Deactivated'),
        render: (row) => (
          <StatusBadge
            status={row.active ? 'active' : 'on_hold'}
            label={row.active ? 'Active' : 'Deactivated'}
            size="sm"
          />
        ),
      },
      {
        key: 'last_active_at',
        header: 'Last active',
        sortValue: (row) => row.last_active_at || '',
        render: (row) => (
          <span className="whitespace-nowrap text-tiny text-muted">
            {row.last_active_at ? relativeTime(row.last_active_at) : 'Never'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        sortable: false,
        width: '3rem',
        align: 'right',
        render: (row) => (
          <RowMenu
            label={`Actions for ${row.name}`}
            items={[
              { label: 'View details', icon: Eye, onSelect: () => setDetailId(row.id) },
              { label: 'Edit user', icon: Pencil, onSelect: () => { setEditing(row); setFormOpen(true) } },
              { label: 'Change role', icon: ShieldCheck, onSelect: () => setRoleTarget(row) },
              {
                label: 'Reset password',
                icon: KeyRound,
                onSelect: () =>
                  setConfirm({
                    kind: 'password',
                    user: row,
                    title: `Reset the password for ${row.name}?`,
                    description:
                      'A new one-time password will be issued and shown to you once. Their current password stops working immediately.',
                    confirmLabel: 'Reset password',
                  }),
              },
              {
                label: row.active ? 'Deactivate' : 'Activate',
                icon: row.active ? Ban : CheckCircle2,
                onSelect: () =>
                  setConfirm({
                    kind: 'status',
                    user: row,
                    title: row.active ? `Deactivate ${row.name}?` : `Activate ${row.name}?`,
                    description: row.active
                      ? 'They will be signed out and blocked from signing in again. Their work and history are kept.'
                      : 'They will be able to sign in again with their existing password.',
                    confirmLabel: row.active ? 'Deactivate' : 'Activate',
                  }),
              },
              {
                label: 'Delete user',
                icon: Trash2,
                destructive: true,
                onSelect: () =>
                  setConfirm({
                    kind: 'delete',
                    user: row,
                    title: `Delete ${row.name}?`,
                    description:
                      'This permanently removes the account. It is refused if they still manage a project or hold open tasks — deactivating is usually the better option.',
                    confirmLabel: 'Delete user',
                  }),
              },
            ]}
          />
        ),
      },
    ],
    [me?.id],
  )

  const filtered = Boolean(debounced || role || status)

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Every account on the platform, what they can reach, and the projects they are attached to."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <UserPlus size={14} />
            Add user
          </Button>
        }
      />

      {counts && (
        <div data-enter className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-tiny text-muted">
          <span>
            <span className="font-medium tabular text-ink">{counts.total}</span> shown
          </span>
          <span>
            <span className="font-medium tabular text-ink">{counts.active}</span> active
          </span>
          {counts.inactive > 0 && (
            <span>
              <span className="font-medium tabular text-ink">{counts.inactive}</span> deactivated
            </span>
          )}
          {ROLES.filter((r) => counts.by_role?.[r]).map((r) => (
            <span key={r}>
              <span className="font-medium tabular text-ink">{counts.by_role[r]}</span>{' '}
              {ROLE_NAMES[r].toLowerCase()}
              {counts.by_role[r] === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      )}

      <div data-enter>
        <AdminToolbar
          query={query}
          onQuery={setQuery}
          placeholder="Search by name, email or title…"
          filters={[
            {
              key: 'role',
              label: 'All roles',
              value: role,
              onChange: setParam('role'),
              options: ROLES.map((value) => ({ value, label: ROLE_NAMES[value] })),
            },
            {
              key: 'status',
              label: 'All statuses',
              value: status,
              onChange: setParam('status'),
              options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Deactivated' },
              ],
            },
          ]}
        />
      </div>

      <div data-enter>
        <AdminTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={rows}
          columns={columns}
          filtered={filtered}
          minWidth="64rem"
          initialSort={{ key: 'name', direction: 'asc' }}
          emptyIcon={UsersIcon}
          emptyTitle="No users yet"
          emptyDescription="Create the first account to give someone access."
          filteredTitle="No users found"
          filteredDescription="Try changing your filters or create a new user."
          errorTitle="Unable to load users"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <UserPlus size={14} />
              Add user
            </Button>
          }
        />
      </div>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={reload}
        user={editing}
        projects={projects || []}
      />
      <RoleChangeModal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        onSaved={reload}
        user={roleTarget}
      />
      <UserDetailDrawer
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        userId={detailId}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title || ''}
        description={confirm?.description || ''}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        loading={busy}
        onConfirm={() => {
          if (!confirm) return undefined
          const { kind, user } = confirm
          if (kind === 'delete') {
            return act(`${user.name} deleted.`, () => adminService.users.remove(user.id))
          }
          if (kind === 'status') {
            return act(
              user.active ? `${user.name} deactivated.` : `${user.name} activated.`,
              () => adminService.users.setStatus(user.id, !user.active),
            )
          }
          return act(`Password reset for ${user.name}.`, async () => {
            const result = await adminService.users.resetPassword(user.id)
            // Shown in its own dialog: a toast would take it away before it
            // could be written down, and it cannot be retrieved again.
            if (result.temporary_password) {
              setIssued({ name: user.name, password: result.temporary_password })
            }
          })
        }}
      />

      <IssuedPasswordModal issued={issued} onClose={() => setIssued(null)} />
    </div>
  )
}

/** Hands over a password that was generated once and is not stored in the clear. */
function IssuedPasswordModal({ issued, onClose }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.info('Copy it manually — the clipboard is unavailable here.')
    }
  }

  return (
    <Modal
      open={Boolean(issued)}
      onClose={onClose}
      title="New password issued"
      description={issued ? `Pass this on to ${issued.name} now.` : ''}
      size="sm"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {issued && (
        <>
          <div className="flex items-start gap-3 rounded-panel border border-amber/30 bg-amber-wash p-4">
            <KeyRound size={16} className="mt-0.5 shrink-0 text-amber-deep" />
            <div className="min-w-0">
              <p className="text-tiny font-medium text-amber-deep">One-time password</p>
              <p className="mt-1.5 break-all font-mono text-body text-ink">{issued.password}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={copy} className="mt-4 w-full">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy password'}
          </Button>
          <p className="mt-3 text-tiny leading-relaxed text-subtle">
            Their previous password has already stopped working. Only a hash of this one is
            stored, so it cannot be shown again.
          </p>
        </>
      )}
    </Modal>
  )
}
