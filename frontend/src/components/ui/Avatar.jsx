import { cn } from '@/lib/cn'
import { initialsOf } from '@/lib/format'

const SIZES = {
  xs: 'h-6 w-6 text-micro',
  sm: 'h-7 w-7 text-micro',
  md: 'h-8 w-8 text-tiny',
  lg: 'h-10 w-10 text-base',
}

export function Avatar({ name, initials, size = 'md', className, title }) {
  return (
    <span
      title={title || name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full',
        'border border-line bg-raised font-medium text-muted',
        SIZES[size],
        className,
      )}
    >
      {initials || initialsOf(name)}
    </span>
  )
}

export function AvatarStack({ people = [], max = 4, size = 'sm' }) {
  const shown = people.slice(0, max)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((person) => (
        <Avatar
          key={person.id || person.name}
          name={person.name}
          initials={person.avatar_initials}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full border border-line bg-surface font-medium text-subtle ring-2 ring-surface',
            SIZES[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
