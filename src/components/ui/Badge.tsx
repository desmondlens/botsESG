import { clsx } from 'clsx'

type BadgeVariant = 'gray' | 'sky' | 'green' | 'amber' | 'red' | 'purple' | 'orange'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const variants: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-600',
  sky: 'bg-sky-50 text-sky-700',
  green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
  orange: 'bg-orange-50 text-orange-700',
}

const dotColors: Record<BadgeVariant, string> = {
  gray: 'bg-gray-400',
  sky: 'bg-sky-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
}

function Badge({ variant = 'gray', children, className, dot = false }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColors[variant])} />
      )}
      {children}
    </span>
  )
}

export { Badge }
export type { BadgeProps, BadgeVariant }