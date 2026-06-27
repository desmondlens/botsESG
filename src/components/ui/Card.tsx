import { clsx } from 'clsx'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg' | 'none'
  onClick?: () => void
  hoverable?: boolean
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

interface CardSectionProps {
  children: React.ReactNode
  className?: string
  border?: boolean
}

const paddings = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

function Card({ children, className, padding = 'md', onClick, hoverable = false }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl border border-gray-200',
        paddings[padding],
        hoverable && 'hover:border-sky-200 hover:shadow-sm transition-all duration-150 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  )
}

function CardHeader({ title, description, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between', className)}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  )
}

function CardSection({ children, className, border = false }: CardSectionProps) {
  return (
    <div className={clsx(border && 'border-t border-gray-100 pt-4 mt-4', className)}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardSection }
export type { CardProps, CardHeaderProps, CardSectionProps }