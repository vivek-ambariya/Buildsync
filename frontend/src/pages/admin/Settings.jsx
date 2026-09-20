import { Fragment } from 'react'
import { Check, Database, Minus, Server, ShieldCheck, Sparkles } from 'lucide-react'

import { adminService } from '@/services'
import { useAsync } from '@/lib/useAsync'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { titleise } from '@/lib/format'
import { ROLES, ROLE_NAMES, ROLE_SUMMARY } from '@/lib/permissions'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/States'

/**
 * The role matrix, shown as it is enforced.
 *
 * Rows are the capabilities the API actually checks, so this table is a
 * readable form of the server's matrix rather than a hand-written summary
 * that can quietly fall out of date.
 */
const MATRIX = [
  { group: 'People', rows: [
    { label: 'View the directory', permission: 'users.view' },
    { label: 'Create and edit users', permission: 'users.create' },
    { label: 'Change roles', permission: 'roles.manage' },
    { label: 'Delete users', permission: 'users.delete' },
    { label: 'Assign people to projects', permission: 'users.assign' },
  ] },
  { group: 'Projects', rows: [
    { label: 'See every project', permission: 'projects.view_all' },
    { label: 'Create projects', permission: 'projects.create' },
    { label: 'Edit projects', permission: 'projects.edit' },
    { label: 'Reassign the manager', permission: 'projects.assign_manager' },
    { label: 'Delete projects', permission: 'projects.delete' },
  ] },
  { group: 'Work', rows: [
    { label: 'Create tasks', permission: 'tasks.create' },
    { label: 'Edit any task', permission: 'tasks.edit' },
    { label: 'Update their own tasks', permission: 'tasks.update_own' },
    { label: 'Delete tasks', permission: 'tasks.delete' },
  ] },
  { group: 'Materials', rows: [
    { label: 'View stock', permission: 'materials.view' },
    { label: 'Add materials', permission: 'materials.create' },
    { label: 'Update stock levels', permission: 'materials.edit' },
    { label: 'Delete materials', permission: 'materials.delete' },
  ] },
  { group: 'Money', rows: [
    { label: 'View expenses and budgets', permission: 'expenses.view' },
    { label: 'Submit expenses', permission: 'expenses.create' },
    { label: 'Edit expenses', permission: 'expenses.edit' },
    { label: 'Delete expenses', permission: 'expenses.delete' },
  ] },
  { group: 'Documents and reports', rows: [
    { label: 'Upload documents', permission: 'documents.upload' },
    { label: 'Delete documents', permission: 'documents.delete' },
    { label: 'View reports', permission: 'reports.view' },
    { label: 'Generate reports', permission: 'reports.generate' },
    { label: 'Delete reports', permission: 'reports.delete' },
  ] },
  { group: 'Site reports', rows: [
    { label: 'File a site report', permission: 'site_updates.create' },
    { label: 'Correct a site report', permission: 'site_updates.edit' },
    { label: 'Delete a site report', permission: 'site_updates.delete' },
  ] },
  { group: 'Intelligence and system', rows: [
    { label: 'View AI insights', permission: 'ai.view' },
    { label: 'Run risk analysis', permission: 'ai.run_analysis' },
    { label: 'Use the AI assistant', permission: 'ai.assistant' },
    { label: 'View system statistics', permission: 'system.stats' },
    { label: 'View activity logs', permission: 'system.activity_logs' },
    { label: 'Change system settings', permission: 'system.settings' },
  ] },
]

// Mirrors app/core/permissions.py. Only used to render the matrix below; the
// authoritative copy is on the server and is what every request is checked
// against.
const GRANTS = {
  admin: null, // every permission
  project_manager: new Set([
    'users.view', 'users.assign', 'projects.create', 'projects.edit',
    'tasks.create', 'tasks.edit', 'tasks.update_own', 'tasks.delete',
    'materials.view', 'materials.create', 'materials.edit', 'materials.delete',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete',
    'documents.view', 'documents.upload', 'documents.edit', 'documents.delete',
    'site_updates.view', 'site_updates.create', 'site_updates.edit', 'site_updates.delete',
    'reports.view', 'reports.generate',
    'ai.view', 'ai.run_analysis', 'ai.assistant',
  ]),
  site_engineer: new Set([
    'users.view', 'tasks.update_own', 'materials.view', 'materials.edit',
    'expenses.view', 'expenses.create', 'documents.view', 'documents.upload',
    'site_updates.view', 'site_updates.create', 'site_updates.edit',
    'reports.view', 'ai.view', 'ai.assistant',
  ]),
  contractor: new Set([
    'users.view', 'tasks.update_own', 'materials.view', 'documents.view',
    'site_updates.view', 'site_updates.create', 'ai.view',
  ]),
}

const granted = (role, permission) =>
  role === 'admin' ? true : GRANTS[role]?.has(permission) || false

export default function AdminSettings() {
  const { permissions } = useAuth()
  const { data, error, loading, reload } = useAsync(() => adminService.system(), [])
  const scope = useEnter([loading, Boolean(data)])

  if (error) {
    return (
      <ErrorState
        title="Unable to load system settings"
        description={error.message}
        onRetry={reload}
      />
    )
  }

  const status = data?.status
  const model = status?.risk_model

  return (
    <div ref={scope}>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="What this deployment is running with, and exactly what each role is allowed to do."
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div data-enter>
          {loading && !data ? (
            <PanelSkeleton rows={4} />
          ) : (
            <Panel>
              <PanelHeader title="Platform" description="Runtime configuration" />
              <dl className="divide-y divide-line">
                <SettingRow icon={Server} label="Application" value={status.app} />
                <SettingRow icon={ShieldCheck} label="Environment" value={titleise(status.environment)} />
                <SettingRow
                  icon={Database}
                  label="Database"
                  value={titleise(status.database)}
                  tone={status.database === 'connected' ? 'healthy' : 'critical'}
                />
                <SettingRow
                  icon={Sparkles}
                  label="Assistant engine"
                  value={
                    status.hosted_assistant
                      ? `${titleise(status.assistant_engine)} (hosted)`
                      : 'Local rules engine'
                  }
                  hint={
                    status.hosted_assistant
                      ? 'A hosted model is configured. The key itself is never sent to the browser.'
                      : 'No hosted model is configured, so answers come from the built-in engine.'
                  }
                />
              </dl>
            </Panel>
          )}
        </div>

        <div data-enter>
          {loading && !data ? (
            <PanelSkeleton rows={4} />
          ) : (
            <Panel>
              <PanelHeader title="Risk model" description="The trained delay classifier" />
              {model?.available ? (
                <dl className="divide-y divide-line">
                  <SettingRow label="Model" value={titleise(model.name)} />
                  <SettingRow
                    label="Trained on"
                    value={`${model.trained_on_rows?.toLocaleString()} projects`}
                  />
                  <SettingRow label="Features" value={`${model.features?.length ?? 0} inputs`} />
                  {model.roc_auc != null && (
                    <SettingRow label="ROC-AUC" value={model.roc_auc.toFixed(3)} tone="healthy" />
                  )}
                  <SettingRow label="Flag threshold" value={`${(model.threshold * 100).toFixed(0)}%`} />
                </dl>
              ) : (
                <div className="p-5">
                  <p className="text-base text-ink">Not loaded</p>
                  <p className="mt-1 text-tiny leading-relaxed text-muted">
                    The model bundle could not be read, so no delay probabilities are produced.
                    Run <code className="font-mono text-ink">python ml/train_model.py</code> to
                    generate it.
                  </p>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      <div data-enter className="mt-4">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Role permissions"
            description="Enforced by the API on every request, not by the interface"
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-base" style={{ minWidth: '46rem' }}>
              <thead>
                <tr className="border-b border-line bg-raised/60">
                  <th scope="col" className="px-5 py-2.5 text-left text-tiny font-medium text-muted">
                    Capability
                  </th>
                  {ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="px-4 py-2.5 text-center text-tiny font-medium text-muted"
                      title={ROLE_SUMMARY[role]}
                    >
                      {ROLE_NAMES[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((group) => (
                  <Fragment key={group.group}>
                    <tr className="border-b border-line bg-raised/30">
                      <th
                        scope="colgroup"
                        colSpan={ROLES.length + 1}
                        className="px-5 py-2 text-left text-micro font-medium uppercase tracking-wide text-subtle"
                      >
                        {group.group}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr
                        key={row.permission}
                        className="border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-raised"
                      >
                        <td className="px-5 py-2.5 text-muted">{row.label}</td>
                        {ROLES.map((role) => (
                          <td key={role} className="px-4 py-2.5 text-center">
                            <Mark allowed={granted(role, row.permission)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div data-enter className="mt-4">
        <Panel className="p-5">
          <p className="text-base font-medium text-ink">Your session</p>
          <p className="mt-1 text-tiny leading-relaxed text-muted">
            You hold {permissions.length} of the platform's capabilities. This list is sent with
            your session so the interface can hide what you cannot use — the server checks every
            request again against the role stored on your account.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function Mark({ allowed }) {
  return allowed ? (
    <Check size={14} className="mx-auto text-healthy" strokeWidth={2.5} aria-label="Allowed" />
  ) : (
    <Minus size={14} className="mx-auto text-line-strong" strokeWidth={2} aria-label="Not allowed" />
  )
}

function SettingRow({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && <Icon size={15} className="mt-0.5 shrink-0 text-subtle" strokeWidth={1.9} />}
        <div className="min-w-0">
          <dt className="text-base text-muted">{label}</dt>
          {hint && <p className="mt-0.5 text-tiny leading-relaxed text-subtle">{hint}</p>}
        </div>
      </div>
      <dd
        className={cn(
          'shrink-0 text-base font-medium',
          tone === 'healthy' ? 'text-healthy' : tone === 'critical' ? 'text-critical' : 'text-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
