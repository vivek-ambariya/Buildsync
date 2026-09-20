import { cn } from '@/lib/cn'

export function Panel({ className, interactive, children, ...props }) {
  return (
    <div className={cn(interactive ? 'panel-interactive' : 'panel', className)} {...props}>
      {children}
    </div>
  )
}

export function PanelHeader({ title, description, action, className }) {
  return (
    <div className={cn('panel-header', className)}>
      <div className="min-w-0">
        <h3 className="panel-title truncate">{title}</h3>
        {description && <p className="mt-0.5 truncate text-tiny text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function PanelBody({ className, children }) {
  return <div className={cn('p-5', className)}>{children}</div>
}
