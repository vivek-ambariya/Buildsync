import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { SiteUpdateFeed } from '@/features/site/SiteUpdateFeed'

export default function SiteUpdates() {
  const { data: projects } = useAsync(() => api.projects.list(), [])
  const scope = useEnter([])

  return (
    <div ref={scope}>
      <PageHeader
        title="Site updates"
        description="The daily record from every site. Progress, headcount and material consumption reported here feed the portfolio figures directly."
      />
      <div data-enter>
        <SiteUpdateFeed projects={projects || []} />
      </div>
    </div>
  )
}
