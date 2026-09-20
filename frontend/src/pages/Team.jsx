import { useMemo } from 'react'
import { Mail, Phone, ShieldCheck, Users } from 'lucide-react'

import { api } from '@/lib/api'
import { ROLE_LABELS, useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

/** What each role can reach, stated plainly rather than as permission flags. */
const ROLE_SCOPE = {
  admin: 'Full access, including creating projects and changing roles.',
  project_manager: 'Projects, tasks, budgets, documents and reports.',
  site_engineer: 'Site reports, tasks, materials and document uploads.',
  contractor: 'The tasks assigned to them, and their own progress.',
}

const ORDER = ['admin', 'project_manager', 'site_engineer', 'contractor']

export default function Team() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useAsync(() => api.users.team(), [])
  const { data: projects } = useAsync(() => api.projects.list(), [])
  const scope = useEnter([loading, Boolean(data)])

  // How many projects each person is attached to, so the directory says
  // something more useful than a job title.
  const load = useMemo(() => {
    const counts = {}
    ;(projects || []).forEach((project) => {
      if (project.manager_id) counts[project.manager_id] = (counts[project.manager_id] || 0) + 1
      ;(project.team || []).forEach((person) => {
        counts[person.id] = (counts[person.id] || 0) + 1
      })
    })
    return counts
  }, [projects])

  if (error) return <ErrorState title="We could not load the team" description={error.message} onRetry={reload} />

  const groups = ORDER.filter((role) => data?.[role]?.length)

  return (
    <div ref={scope}>
      <PageHeader
        title="Team"
        description="Everyone with access, and what their role lets them reach. The interface adapts to the role, so a contractor never sees a budget they cannot act on."
      />

      {loading && !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
        </div>
      ) : groups.length === 0 ? (
        <Panel data-enter>
          <EmptyState icon={Users} title="No team members yet" description="People appear here once accounts are created." />
        </Panel>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {groups.map((role) => (
            <Panel key={role} data-enter>
              <PanelHeader
                title={ROLE_LABELS[role]}
                description={ROLE_SCOPE[role]}
                action={
                  <span className="rounded-pill bg-raised px-2 py-0.5 text-micro tabular text-muted">
                    {data[role].length}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {data[role].map((person) => (
                  <li key={person.id} className="flex items-start gap-3 px-5 py-4">
                    <Avatar name={person.name} initials={person.avatar_initials} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-medium text-ink">{person.name}</p>
                        {person.id === user?.id && (
                          <span className="rounded-pill border border-line bg-raised px-2 py-0.5 text-micro text-muted">
                            you
                          </span>
                        )}
                        {role === 'admin' && (
                          <ShieldCheck size={13} className="text-amber-deep" title="Full access" />
                        )}
                      </div>
                      <p className="truncate text-tiny text-muted">{person.title}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <a
                          href={`mailto:${person.email}`}
                          className="flex items-center gap-1.5 text-micro text-muted transition-colors hover:text-ink"
                        >
                          <Mail size={11} />
                          {person.email}
                        </a>
                        {person.phone && (
                          <a
                            href={`tel:${person.phone.replace(/\s/g, '')}`}
                            className="flex items-center gap-1.5 text-micro text-muted transition-colors hover:text-ink"
                          >
                            <Phone size={11} />
                            {person.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={cn('font-display text-h4 tabular', load[person.id] ? 'text-ink' : 'text-line-strong')}>
                        {load[person.id] || 0}
                      </p>
                      <p className="text-micro text-subtle">
                        {load[person.id] === 1 ? 'project' : 'projects'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
