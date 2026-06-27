import { clsx } from 'clsx'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const defaultIcon = (
  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
)

const sizes = {
  sm: 'py-8 px-6',
  md: 'py-12 px-8',
  lg: 'py-16 px-8',
}

function EmptyState({ title, description, action, icon, className, size = 'md' }: EmptyStateProps) {
  return (
    <div className={clsx('text-center', sizes[size], className)}>
      <div className="flex justify-center mb-3">
        {icon ?? defaultIcon}
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }