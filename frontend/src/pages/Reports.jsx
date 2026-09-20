import { useMemo, useState } from 'react'
import { Download, FileBarChart, Printer, Trash2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useAsync } from '@/lib/useAsync'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { formatDate, relativeTime } from '@/lib/format'
import { useEnter } from '@/animations/useMotion'
import { PageHeader } from '@/layouts/PageHeader'
import { ProgressChart } from '@/charts/ProgressChart'
import { Button } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Panel, PanelHeader } from '@/components/ui/Panel'
import { PanelSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'

const DESCRIPTIONS = {
  daily_site: 'Reports filed from site, headcount deployed and issues raised over the period.',
  weekly_project: 'Portfolio position, project-by-project variance and work closed out this week.',
  budget: 'Approved against committed spend, split by category, with cost performance per project.',
  progress: 'Completion and rate of build, with the forecast finish date for every project.',
  risk: 'Every open finding, its measure and the recommended action, ordered by severity.',
}

export default function Reports() {
  const { can } = useAuth()
  const toast = useToast()
  const { data: types } = useAsync(() => api.reports.types(), [])
  const { data: projects } = useAsync(() => api.projects.list(), [])
  const { data: history, loading: loadingHistory, reload: reloadHistory } = useAsync(() => api.reports.list(), [])

  const [reportType, setReportType] = useState('weekly_project')
  const [projectId, setProjectId] = useState('')
  const [period, setPeriod] = useState(7)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [removing, setRemoving] = useState(false)
  const scope = useEnter([])

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const result = await api.reports.generate({
        report_type: reportType,
        project_id: projectId || null,
        period_days: Number(period),
      })
      setReport(result)
      reloadHistory()
      toast.success('Report generated', result.title)
    } catch (err) {
      setError(err.message)
      toast.error('Could not generate that report', err.message)
    } finally {
      setGenerating(false)
    }
  }

  const open = async (id) => {
    setLoadingReport(true)
    try {
      setReport(await api.reports.get(id))
    } catch (err) {
      toast.error('Could not open that report', err.message)
    } finally {
      setLoadingReport(false)
    }
  }

  const remove = async () => {
    setRemoving(true)
    try {
      await api.reports.remove(deleting.id)
      if (report?.id === deleting.id) setReport(null)
      setDeleting(null)
      reloadHistory()
      toast.success('Report deleted')
    } catch (err) {
      toast.error('Could not delete that report', err.message)
    } finally {
      setRemoving(false)
    }
  }

  const exportCsv = () => {
    if (!report) return
    const lines = [`${report.title} — ${report.project_name}`, `Generated ${formatDate(report.created_at)}`, '']
    report.sections.forEach((section) => {
      lines.push(section.heading)
      if (section.kind === 'metrics') {
        section.items.forEach((item) => lines.push(`${item.label},${item.value}`))
      } else if (section.kind === 'table') {
        lines.push(section.columns.join(','))
        section.rows.forEach((row) => lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')))
      } else if (section.kind === 'list') {
        section.items.forEach((item) => lines.push(`"${String(item).replace(/"/g, '""')}"`))
      }
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${report.report_type}-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Report exported', 'Saved as CSV')
  }

  const typeOptions = useMemo(() => types || [], [types])

  return (
    <div ref={scope}>
      <PageHeader
        title="Reports"
        description="Generate a report from live data. Nothing is cached, so what you export is what the projects said the moment you pressed the button."
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)] print:block">
        {/* Controls + history */}
        <div className="space-y-4 print:hidden" data-enter>
          <Panel>
            <PanelHeader title="Generate a report" />
            <div className="space-y-4 p-5">
              <Field label="Report type">
                <Select value={reportType} onChange={(event) => setReportType(event.target.value)}>
                  {typeOptions.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </Field>
              <p className="-mt-1 text-tiny leading-relaxed text-muted">{DESCRIPTIONS[reportType]}</p>

              <Field label="Scope">
                <Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">Every project</option>
                  {(projects || []).map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Period">
                <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
                  {[
                    [1, 'Yesterday and today'],
                    [7, 'Last 7 days'],
                    [14, 'Last fortnight'],
                    [30, 'Last 30 days'],
                    [90, 'Last quarter'],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>

              <Button
                variant="primary"
                className="w-full"
                onClick={generate}
                loading={generating}
                disabled={!can('generateReports')}
              >
                <FileBarChart size={15} />
                Generate report
              </Button>
              {!can('generateReports') && (
                <p className="text-tiny text-muted">
                  Your role can read reports but not generate them. Ask a project manager to run it.
                </p>
              )}
              {error && <p className="text-tiny text-critical">{error}</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Previously generated" />
            {loadingHistory ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-9" />
                ))}
              </div>
            ) : (history || []).length === 0 ? (
              <p className="px-5 py-6 text-base text-muted">Nothing generated yet.</p>
            ) : (
              <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                {history.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => open(item.id)}
                      className={cn(
                        'min-w-0 flex-1 rounded-control px-2 py-1 text-left transition-colors hover:bg-raised',
                        report?.id === item.id && 'bg-raised',
                      )}
                    >
                      <span className="block truncate text-base text-ink">{item.title}</span>
                      <span className="block truncate text-micro text-subtle">
                        {item.project_name} · {relativeTime(item.created_at)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(item)}
                      className="shrink-0 rounded p-1.5 text-subtle transition-colors hover:bg-critical-wash hover:text-critical"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Preview */}
        <div data-enter>
          {loadingReport || generating ? (
            <PanelSkeleton rows={6} />
          ) : !report ? (
            <Panel className="h-full">
              <EmptyState
                icon={FileBarChart}
                title="No report open"
                description="Choose a type and period on the left, then generate. The preview appears here ready to export or print."
              />
            </Panel>
          ) : (
            <ReportPreview report={report} onExport={exportCsv} />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        loading={removing}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this report?"
        confirmLabel="Delete report"
        description={`"${deleting?.title}" will be removed from the history. You can always generate it again from live data.`}
      />
    </div>
  )
}

function ReportPreview({ report, onExport }) {
  return (
    <Panel className="overflow-hidden print:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <p className="text-tiny font-medium text-muted">{report.project_name}</p>
          <h2 className="mt-1 font-display text-h3 text-ink">{report.title}</h2>
          <p className="mt-1.5 text-tiny text-muted">
            {formatDate(report.period_start)} to {formatDate(report.period_end)} · generated by {report.generated_by}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer size={13} />
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download size={13} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="divide-y divide-line">
        {report.sections.map((section, index) => (
          <section key={index} className="px-6 py-5">
            <h3 className="panel-title mb-3.5">{section.heading}</h3>

            {section.kind === 'metrics' && (
              <dl className="grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
                {section.items.map((item) => (
                  <div key={item.label} className="bg-surface px-4 py-3.5">
                    <dt className="text-micro text-subtle">{item.label}</dt>
                    <dd className="mt-1 font-display text-h4 tabular text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {section.kind === 'table' && (
              <div className="overflow-x-auto rounded-panel border border-line">
                <table className="w-full min-w-[36rem] border-collapse text-base">
                  <thead>
                    <tr className="border-b border-line bg-raised/60">
                      {section.columns.map((column) => (
                        <th key={column} scope="col" className="px-4 py-2.5 text-left text-tiny font-medium text-muted">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {section.rows.length === 0 ? (
                      <tr>
                        <td colSpan={section.columns.length} className="px-4 py-6 text-center text-base text-muted">
                          Nothing in this period.
                        </td>
                      </tr>
                    ) : (
                      section.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="transition-colors hover:bg-raised">
                          {row.map((cell, cellIndex) => (
                            <td
                              key={cellIndex}
                              className={cn(
                                'px-4 py-3 align-top',
                                cellIndex === 0 ? 'font-medium text-ink' : 'tabular text-muted',
                              )}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {section.kind === 'list' && (
              <ul className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2.5 text-base leading-relaxed text-muted">
                    <span className="pt-[0.45em] text-line-strong" aria-hidden>—</span>
                    <span className="min-w-0">{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.kind === 'chart' && section.chart?.data?.length > 0 && (
              <ProgressChart data={section.chart.data} title="Planned against actual" height={260} />
            )}
          </section>
        ))}
      </div>
    </Panel>
  )
}
