import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'

import { api } from '@/lib/api'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { AIInsightCard } from '@/components/AIInsightCard'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { PanelSkeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

export function ProjectInsightsTab({ project }) {
  const toast = useToast()
  const { data, error, loading, reload, setData } = useAsync(() => api.ai.insights(project.id), [project.id])
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    try {
      await api.ai.refresh(project.id)
      await reload()
      toast.success('Findings recalculated', project.name)
    } catch (err) {
      toast.error('Could not recalculate the findings', err.message)
    } finally {
      setRefreshing(false)
    }
  }

  const onAcknowledged = (id) =>
    setData((current) => ({
      ...current,
      findings: current.findings.map((finding) =>
        finding.id === id ? { ...finding, acknowledged: true } : finding,
      ),
    }))

  if (error) return <ErrorState title="We could not load the findings" description={error.message} onRetry={reload} />
  if (loading && !data) return <PanelSkeleton rows={4} />

  const findings = data?.findings || []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-tiny text-muted">
          {findings.length
            ? `${findings.length} findings · ${data.counts.high} high, ${data.counts.medium} medium`
            : 'Nothing flagged on this project'}
          {' · every figure is computed from this project’s own records'}
        </p>
        <Button variant="secondary" onClick={refresh} loading={refreshing}>
          <RefreshCw size={14} />
          Recalculate
        </Button>
      </div>

      {findings.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Sparkles}
            title="Nothing needs attention"
            description="Progress is tracking to plan, spending matches the work delivered, and every material has enough cover on site."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {findings.map((finding) => (
            <AIInsightCard key={finding.id} insight={finding} onAcknowledged={onAcknowledged} />
          ))}
        </div>
      )}
    </div>
  )
}
