import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success'

const btnClass: Record<Variant, string> = {
  primary:   'bg-[var(--primary)] text-white hover:opacity-90 shadow-md shadow-[var(--primary)]/25',
  secondary: 'bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border-strong)]',
  ghost:     'bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]',
  danger:    'bg-[var(--danger)] text-white hover:opacity-90',
  outline:   'border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] hover:text-[var(--primary)]',
  success:   'bg-[var(--success)] text-white hover:opacity-90',
}

export function Button({
  variant = 'primary', size = 'md', loading, className = '', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' }
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 ${btnClass[variant]} ${sizes[size]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Card({ children, className = '', interactive, padding = 'md', onClick }: {
  children: ReactNode; className?: string; interactive?: boolean; padding?: 'none' | 'sm' | 'md' | 'lg'; onClick?: () => void
}) {
  const pad = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }
  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl ${pad[padding]} ${
        interactive ? 'transition-all active:scale-[0.99] cursor-pointer hover:border-[var(--primary)]/40 hover:shadow-md' : ''
      } ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  function Input({ label, error, className = '', ...props }, ref) {
    return (
      <label className="block w-full">
        {label && <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block font-semibold">{label}</span>}
        <input
          ref={ref}
          className={`w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-[var(--danger)] mt-1 block">{error}</span>}
      </label>
    )
  }
)

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
        active ? 'bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/30'
               : 'bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--primary)]/40'
      }`}
    >
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'success' | 'danger' | 'warning' }) {
  const v = {
    default: 'bg-[var(--primary-soft)] text-[var(--primary)]',
    success: 'bg-[var(--success)]/15 text-[var(--success)]',
    danger:  'bg-[var(--danger)]/15 text-[var(--danger)]',
    warning: 'bg-[var(--warning)]/15 text-[var(--warning)]',
  }
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${v[variant]}`}>{children}</span>
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{title}</h2>
      {action}
    </div>
  )
}

export function Divider() {
  return <div className="h-px bg-[var(--border)] my-3" />
}
