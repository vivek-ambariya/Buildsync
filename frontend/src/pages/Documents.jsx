import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { DocumentLibrary } from '@/features/documents/DocumentLibrary'

export default function Documents() {
  const { data: projects } = useAsync(() => api.projects.list(), [])
  const scope = useEnter([])

  return (
    <div ref={scope}>
      <PageHeader
        title="Documents"
        description="Every BOQ, invoice, contract, drawing and site report across the portfolio. Uploads are read on arrival and their quantities, rates and vendors pulled out."
      />
      <div data-enter>
        <DocumentLibrary projects={projects || []} />
      </div>
    </div>
  )
}
