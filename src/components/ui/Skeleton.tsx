import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

interface SkeletonTextProps {
  lines?: number
  className?: string
}

interface SkeletonCardProps {
  rows?: number
  className?: string
}

function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  const roundedMap = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }
  return (
    <div
      className={clsx(
        'bg-gray-100 animate-pulse',
        roundedMap[rounded],
        className
      )}
    />
  )
}

function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={clsx('h-3', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  )
}

function SkeletonCard({ rows = 3, className }: SkeletonCardProps) {
  return (
    <div className={clsx('bg-white rounded-xl border border-gray-200 p-5 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-16" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={clsx('bg-white rounded-xl border border-gray-200 p-5', className)}>
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  )
}

function SkeletonPage({ className }: { className?: string }) {
  return (
    <div className={clsx('p-8 space-y-6', className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>
      <SkeletonCard rows={4} />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard, SkeletonStat, SkeletonPage }