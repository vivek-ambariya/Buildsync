import { useNavigate } from 'react-router-dom'
import { Building2, LogOut, Mail, Phone, ShieldCheck } from 'lucide-react'

import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useEnter } from '@/animations/useMotion'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useSite } from '@/features/site-ops/SiteContext'

/**
 * Who you are, which sites you are on, and what the app will let you do.
 *
 * The permission list is shown rather than implied. On a shared site phone
 * "why can't I see the budget" is a real question, and answering it here is
 * cheaper than answering it by radio.
 */
const CAN = [
  ['Update task progress', 'manageTasks'],
  ['Upload site photos', 'uploadSitePhotos'],
  ['Report site issues', 'reportIssues'],
  ['Record material usage', 'manageMaterials'],
  ['Request materials', 'requestMaterials'],
  ['Record workforce', 'recordWorkforce'],
  ['Submit daily reports', 'fileSiteUpdates'],
  ['Upload documents', 'uploadDocuments'],
]

const CANNOT = [
  'Manage users or roles',
  'Create or delete projects',
  'Change project budgets',
  'Access sites you are not on',
  'Change project ownership',
]

export default function SiteProfile() {
  const { user, roleLabel, signOut, can } = useAuth()
  const { theme, toggle } = useTheme()
  const { projects, project, selectProject } = useSite()
  const navigate = useNavigate()
  const scope = useEnter([])

  return (
    <div ref={scope}>
      <header className="mb-5 flex items-center gap-3.5" data-enter>
        <Avatar name={user?.name} initials={user?.avatar_initials} size="lg" className="h-14 w-14 text-base" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-h3 leading-tight text-ink">{user?.name}</h1>
          <p className="truncate text-body text-muted">{user?.title || roleLabel}</p>
        </div>
      </header>

      <section className="mb-4 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface" data-enter>
        <Row icon={Mail} label="Email" value={user?.email} />
        {user?.phone && <Row icon={Phone} label="Phone" value={user.phone} />}
        <Row icon={ShieldCheck} label="Role" value={roleLabel} />
      </section>

      <section className="mb-4" data-enter>
        <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-muted">Your sites</h2>
        <ul className="space-y-2">
          {projects.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => selectProject(option.id)}
                className={`tap flex w-full items-center gap-3 rounded-panel border px-4 text-left ${
                  option.id === project?.id ? 'border-ink bg-raised' : 'border-line bg-surface'
                }`}
              >
                <Building2 size={17} className="shrink-0 text-subtle" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink">{option.name}</span>
                  <span className="block truncate text-tiny text-subtle">
                    {option.location || option.code} · {Math.round(option.actual_progress || 0)}% complete
                  </span>
                </span>
                <StatusBadge status={option.status} size="sm" className="shrink-0" />
              </button>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="rounded-panel border border-line bg-surface px-4 py-3.5 text-base text-muted">
              You are not attached to a site yet.
            </li>
          )}
        </ul>
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2" data-enter>
        <div className="rounded-panel border border-line bg-surface p-4">
          <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-healthy">You can</h2>
          <ul className="space-y-1.5">
            {CAN.filter(([, permission]) => can(permission)).map(([label]) => (
              <li key={label} className="text-base text-ink">
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-panel border border-line bg-surface p-4">
          <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-[0.05em] text-subtle">You cannot</h2>
          <ul className="space-y-1.5">
            {CANNOT.map((label) => (
              <li key={label} className="text-base text-subtle">
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-2" data-enter>
        <button
          type="button"
          onClick={toggle}
          className="tap flex w-full items-center justify-between gap-3 rounded-panel border border-line bg-surface px-4 text-base text-ink"
        >
          Appearance
          <span className="text-tiny text-muted">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={() => {
            signOut()
            navigate('/login')
          }}
        >
          <LogOut size={16} />
          Log out
        </Button>
      </section>
    </div>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon size={16} className="shrink-0 text-subtle" />
      <span className="w-20 shrink-0 text-tiny text-subtle">{label}</span>
      <span className="min-w-0 flex-1 truncate text-base text-ink">{value || '—'}</span>
    </div>
  )
}
