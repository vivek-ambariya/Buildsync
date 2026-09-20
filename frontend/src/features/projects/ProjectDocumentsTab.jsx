import { DocumentLibrary } from '@/features/documents/DocumentLibrary'

export function ProjectDocumentsTab({ project }) {
  return <DocumentLibrary projectId={project.id} projects={[project]} showProjectColumn={false} />
}
