import { cn } from '@/lib/cn'
import { Panel } from './Panel'

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={cn('h-3', index === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function MetricSkeleton() {
  return (
    <Panel className="p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-4 h-3 w-20" />
    </Panel>
  )
}

export function PanelSkeleton({ rows = 4, title = true, className }) {
  return (
    <Panel className={className}>
      {title && (
        <div className="panel-header">
          <Skeleton className="h-3 w-32" />
        </div>
      )}
      <div className="space-y-3.5 p-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <Panel className="overflow-hidden">
      <div className="border-b border-line bg-raised px-5 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-6 px-5 py-3.5">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn('h-3', colIndex === 0 ? 'w-1/3' : 'flex-1')}
              />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function ChartSkeleton({ height = 'h-64' }) {
  return (
    <Panel>
      <div className="panel-header">
        <Skeleton className="h-3 w-36" />
      </div>
      <div className={cn('flex items-end gap-2 p-5', height)}>
        {[52, 68, 45, 78, 62, 88, 70, 95].map((value, index) => (
          <Skeleton key={index} className="flex-1 rounded-t" style={{ height: `${value}%` }} />
        ))}
      </div>
    </Panel>
  )
}
