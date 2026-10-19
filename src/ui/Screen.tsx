import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export function Screen({ title, subtitle, children, onBack, rightAction, noPadding, className = '' }: {
  title?: string; subtitle?: string; children: ReactNode; onBack?: boolean | (() => void)
  rightAction?: ReactNode; noPadding?: boolean; className?: string
}) {
  const navigate = useNavigate()
  const handleBack = typeof onBack === 'function' ? onBack : onBack ? () => navigate(-1) : undefined
  return (
    <div className={`min-h-full bg-[var(--bg)] text-[var(--text)] animate-fade-in ${className}`}>
      {(title || handleBack) && (
        <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-3">
          {handleBack && (
            <button type="button" onClick={handleBack} aria-label="Voltar"
              className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors flex-shrink-0">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
            {subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>}
          </div>
          {rightAction}
        </header>
      )}
      <div className={noPadding ? '' : 'px-4 pt-4 pb-28 lg:pb-8 max-w-2xl mx-auto w-full'}>
        {children}
      </div>
    </div>
  )
}

export function FAB({ onClick, label = 'Adicionar' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl text-white flex items-center justify-center active:scale-95 transition-transform duration-200 lg:bottom-8 lg:right-8"
      style={{ background: 'var(--primary)', boxShadow: 'var(--shadow-fab)' }}>
      <span className="text-2xl font-light leading-none">+</span>
    </button>
  )
}

export function PageHeader({ title, subtitle, rightAction, children }: {
  title: string; subtitle?: string; rightAction?: ReactNode; children?: ReactNode
}) {
  return (
    <div className="pt-5 pb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {rightAction}
      </div>
      {children}
    </div>
  )
}
