import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'

import { adminService } from '@/services'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/cn'
import { formatDate, relativeTime } from '@/lib/format'
import { ROLE_NAMES, ROLE_SUMMARY } from '@/lib/permissions'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { Avatar } from '@/components/ui/Avatar'
import { Drawer } from '@/components/ui/Modal'
import { SkeletonText } from '@/components/ui/Skeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState, ErrorState } from '@/components/ui/States'

/** Everything the platform knows about one account, in one panel. */
export function UserDetailDrawer({ open, onClose, userId }) {
  const { data, error, loading, reload } = useAsync(
    () => (userId ? adminService.users.get(userId) : Promise.resolve(null)),
    [userId, open],
  )

  return (
    <Drawer open={open} onClose={onClose} title="User details" width="max-w-xl">
      {loading && !data ? (
        <SkeletonText lines={8} />
      ) : error ? (
        <ErrorState
          compact
          title="Unable to load this account"
          description={error.message}
          onRetry={reload}
        />
      ) : !data ? null : (
        <div className="space-y-6">
          <div className="flex items-start gap-3.5">
            <Avatar name={data.name} initials={data.avatar_initials} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-display text-h4 text-ink">{data.name}</h3>
                <StatusBadge
                  status={data.active ? 'active' : 'on_hold'}
                  label={data.active ? 'Active' : 'Deactivated'}
                  size="sm"
                />
              </div>
              <p className="mt-0.5 text-tiny text-muted">{data.title || ROLE_NAMES[data.role]}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <a
                  href={`mailto:${data.email}`}
                  className="flex items-center gap-1.5 text-micro text-muted transition-colors hover:text-ink"
                >
                  <Mail size={11} />
                  {data.email}
                </a>
                {data.phone && (
                  <a
                    href={`tel:${data.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-1.5 text-micro text-muted transition-colors hover:text-ink"
                  >
                    <Phone size={11} />
                    {data.phone}
                  </a>
                )}
              </div>
            </div>
          </div>

          <section className="rounded-panel border border-line bg-raised p-4">
            <p className="text-tiny font-medium text-ink">{ROLE_NAMES[data.role]}</p>
            <p className="mt-1 text-tiny leading-relaxed text-muted">{ROLE_SUMMARY[data.role]}</p>
          </section>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Projects" value={data.project_count} />
            <Stat label="Manages" value={data.managed_count} />
            <Stat label="Open tasks" value={data.open_tasks} />
            <Stat label="Completed" value={data.completed_tasks} />
          </dl>

          <dl className="space-y-2 border-t border-line pt-4 text-tiny">
            <Row label="Account created" value={data.created_at ? formatDate(data.created_at) : 'Unknown'} />
            <Row
              label="Last active"
              value={data.last_active_at ? relativeTime(data.last_active_at) : 'Never signed in'}
            />
          </dl>

          <section>
            <h4 className="mb-2 text-tiny font-medium text-ink">Projects</h4>
            {data.projects.length === 0 ? (
              <p className="rounded-control border border-line bg-raised px-3 py-2.5 text-tiny text-subtle">
                Not assigned to any project.
              </p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {data.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      to={`/admin/projects/${project.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-raised"
                    >
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{project.name}</span>
                      {project.role_on_project === 'manager' && (
                        <span className="shrink-0 rounded-pill border border-amber/30 bg-amber-wash px-2 py-0.5 text-micro font-medium text-amber-deep">
                          manager
                        </span>
                      )}
                      <StatusBadge status={project.status} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-tiny font-medium text-ink">Recent activity</h4>
            {data.activity.length === 0 ? (
              <EmptyState compact title="No activity yet" description="Nothing recorded for this account." />
            ) : (
              <ActivityTimeline items={data.activity} />
            )}
          </section>
        </div>
      )}
    </Drawer>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <dd className={cn('font-display text-h4 font-semibold tabular', value ? 'text-ink' : 'text-line-strong')}>
        {value}
      </dd>
      <dt className="mt-0.5 text-micro text-subtle">{label}</dt>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}
