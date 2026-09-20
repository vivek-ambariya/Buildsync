import { SiteUpdateFeed } from '@/features/site/SiteUpdateFeed'

export function SiteUpdatesTab({ project }) {
  return <SiteUpdateFeed projectId={project.id} projects={[project]} showProject={false} />
}
