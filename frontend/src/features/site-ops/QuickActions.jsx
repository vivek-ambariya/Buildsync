import { useState } from 'react'
import { Camera, ClipboardList, Gauge, HardHat, Package, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { ProgressUpdateSheet } from './ProgressUpdateSheet'
import { IssueSheet } from './IssueSheet'
import { MaterialRequestSheet, MaterialUsageSheet } from './MaterialSheets'
import { WorkforceSheet } from './WorkforceSheet'
import { DailyReportWizard } from './DailyReportWizard'
import { PhotoUploadSheet } from './PhotoUploadSheet'

/**
 * The six things a site manager does during a day.
 *
 * Laid out as slabs rather than buttons: two columns on a phone, each tall
 * enough to hit without looking, with the amber-led primary action first.
 * The grid is the same on every screen it appears on, so the position of
 * "Report issue" becomes muscle memory rather than something to hunt for.
 *
 * Every sheet the tiles open lives here too, which is why any screen can drop
 * `<QuickActions />` in and get the whole set of workflows with it.
 */
const ACTIONS = [
  { key: 'progress', label: 'Update progress', icon: Gauge, accent: true },
  { key: 'photos', label: 'Upload site photos', icon: Camera, permission: 'uploadSitePhotos' },
  { key: 'issue', label: 'Report issue', icon: TriangleAlert, tone: 'critical', permission: 'reportIssues' },
  // The daily report is the site manager's account of the whole site, so it
  // is offered in their workspace only — a contractor records their own
  // progress instead.
  { key: 'report', label: 'Daily site report', icon: ClipboardList, workspaces: ['site-manager'] },
  { key: 'material', label: 'Update material', icon: Package, permission: 'manageMaterials' },
  { key: 'workforce', label: 'Update workforce', icon: HardHat, permission: 'recordWorkforce' },
]

export function QuickActions({ className, onChanged, columns = 2 }) {
  const { can, workspace } = useAuth()
  const [sheet, setSheet] = useState(null)
  const close = () => setSheet(null)

  const visible = ACTIONS.filter(
    (action) =>
      (!action.permission || can(action.permission)) &&
      (!action.workspaces || action.workspaces.includes(workspace?.slug)),
  )

  return (
    <>
      <div
        className={cn('grid gap-2.5', className)}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visible.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => setSheet(action.key)}
            className={cn(
              'field-tile',
              action.accent && 'border-amber/50 bg-amber-wash',
              action.tone === 'critical' && 'border-critical/25',
            )}
          >
            <action.icon
              size={22}
              strokeWidth={1.9}
              className={cn(
                'shrink-0',
                action.accent ? 'text-amber-deep' : action.tone === 'critical' ? 'text-critical' : 'text-muted',
              )}
            />
            <span
              className={cn(
                'text-base font-medium leading-tight',
                action.accent ? 'text-amber-deep' : 'text-ink',
              )}
            >
              {action.label}
            </span>
          </button>
        ))}
      </div>

      <ProgressUpdateSheet open={sheet === 'progress'} onClose={close} onSaved={onChanged} />
      <PhotoUploadSheet open={sheet === 'photos'} onClose={close} onSaved={onChanged} />
      <IssueSheet open={sheet === 'issue'} onClose={close} onSaved={onChanged} />
      <DailyReportWizard open={sheet === 'report'} onClose={close} onSubmitted={onChanged} />
      <MaterialUsageSheet open={sheet === 'material'} onClose={close} onSaved={onChanged} />
      <MaterialRequestSheet open={sheet === 'request'} onClose={close} onSaved={onChanged} />
      <WorkforceSheet open={sheet === 'workforce'} onClose={close} onSaved={onChanged} />
    </>
  )
}
