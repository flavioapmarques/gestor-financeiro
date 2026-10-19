import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, WifiOff, Loader2, Inbox, CreditCard, Target } from 'lucide-react'
import { Button } from './primitives'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--bg-muted)] rounded-xl ${className}`} />
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

const emptyIcons = {
  transacoes: Inbox,
  cartoes: CreditCard,
  metas: Target,
} as const

export function EmptyState({
  variant = 'transacoes',
  title,
  description,
  action,
}: {
  variant?: keyof typeof emptyIcons
  title: string
  description: string
  action?: ReactNode
}) {
  const Icon = emptyIcons[variant]
  return (
    <div className="flex flex-col items-center text-center py-16 px-6" role="status">
      <div className="w-20 h-20 rounded-3xl bg-[var(--primary-soft)] flex items-center justify-center mb-4">
        <Icon size={36} className="text-[var(--primary)]" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-[260px] mb-6">{description}</p>
      {action}
    </div>
  )
}

export function StateScreen({
  type,
  title,
  message,
  onRetry,
}: {
  type: 'loading' | 'success' | 'error' | 'offline'
  title: string
  message?: string
  onRetry?: () => void
}) {
  const icons = {
    loading: <Loader2 size={48} className="text-[var(--primary)] animate-spin" />,
    success: <CheckCircle2 size={48} className="text-[var(--success)]" />,
    error: <AlertCircle size={48} className="text-[var(--danger)]" />,
    offline: <WifiOff size={48} className="text-[var(--warning)]" />,
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center" role="alert" aria-live="polite">
      <div className="mb-4">{icons[type]}</div>
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      {message && <p className="text-sm text-[var(--text-muted)] max-w-xs">{message}</p>}
      {onRetry && (
        <Button className="mt-6" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
