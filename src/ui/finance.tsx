import type { ReactNode } from 'react'
import { CreditCard } from 'lucide-react'
import { formatBRL } from '../lib/utils'
import { CardBrandBadge } from '../components/CardBrandBadge'

export function CreditCardVisual({ nome, banco, bandeira, limite, usado, cor, compact }: {
  nome: string; banco: string; bandeira: string; limite: number; usado: number; cor: string; compact?: boolean
}) {
  const pct = limite > 0 ? Math.min(100, (usado / limite) * 100) : 0
  const dangerZone = pct > 80
  return (
    <div
      className={`relative overflow-hidden rounded-2xl text-white ${compact ? 'h-36' : 'h-48'}`}
      style={{
        background: `linear-gradient(135deg, ${cor}EE 0%, ${cor}88 50%, #1a1f36 100%)`,
        boxShadow: `0 16px 48px ${cor}44`,
      }}
    >
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_20%,white,transparent_55%)]" />
      <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-white/5 -mr-10 -mb-10" />
      <div className="relative p-5 h-full flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] uppercase tracking-widest opacity-70 font-semibold">{banco}</p>
            <p className="font-bold text-base mt-0.5 tracking-tight">{nome}</p>
          </div>
          <CardBrandBadge bandeira={bandeira} size="md" />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="opacity-70">Limite utilizado</span>
            <span className="font-semibold" style={{ color: dangerZone ? '#FFB020' : 'white' }}>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: dangerZone ? '#FFB020' : 'rgba(255,255,255,0.85)' }}
            />
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-[10px] opacity-60 mb-0.5">Utilizado</p>
              <p className="text-base font-bold font-mono tracking-tight">{formatBRL(usado)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-60 mb-0.5">Disponível</p>
              <p className="text-base font-bold font-mono tracking-tight text-white/80">{formatBRL(Math.max(0, limite - usado))}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StatCard({ label, value, variant = 'default', sub, icon }: {
  label: string; value: string; variant?: 'default' | 'success' | 'danger' | 'primary' | 'warning'; sub?: string; icon?: ReactNode
}) {
  const colors = {
    default: 'text-[var(--text)]',
    success: 'text-[var(--success)]',
    danger:  'text-[var(--danger)]',
    primary: 'text-[var(--primary)]',
    warning: 'text-[var(--warning)]',
  }
  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4 min-w-0" style={{ boxShadow: 'var(--shadow-sm)' }}>
      {icon && <div className="mb-2 text-[var(--text-muted)]">{icon}</div>}
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold truncate">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 truncate ${colors[variant]}`}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-subtle)] mt-1">{sub}</p>}
    </div>
  )
}

export function ProgressBar({ value, max, color = 'var(--primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function MoneyDisplay({ value, size = 'lg', positive, oculto }: { value: number; size?: 'sm' | 'md' | 'lg' | 'xl'; positive?: boolean; oculto?: boolean }) {
  const sizes = { sm: 'text-base', md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl' }
  // Se 'positive' não for informado, detecta automaticamente pelo sinal real do valor
  // (ex.: saldo total negativo deve aparecer em vermelho com o "-", não como se fosse positivo)
  const negativo = positive === false || (positive === undefined && value < 0)
  const sign = positive === true ? '+' : negativo ? '-' : ''
  const cor = positive === true ? 'text-[var(--success)]' : negativo ? 'text-[var(--danger)]' : 'text-[var(--text)]'
  return (
    <span className={`font-mono font-bold tracking-tight leading-none ${sizes[size]} ${cor}`}>
      {oculto ? 'R$ ••••••' : <>{sign}{formatBRL(Math.abs(value))}</>}
    </span>
  )
}

export function QuickAction({ icon, label, onClick, color }: { icon: ReactNode; label: string; onClick?: () => void; color?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 min-w-[64px] transition-all active:scale-95">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: color ? `${color}22` : 'var(--primary-soft)', color: color ?? 'var(--primary)' }}
      >
        {icon}
      </div>
      <span className="text-[10px] text-[var(--text-muted)] font-semibold text-center leading-tight">{label}</span>
    </button>
  )
}

export function TxIcon({ tipo, cor, viaCartao }: { tipo: 'receita' | 'despesa' | 'transferencia'; cor?: string; viaCartao?: boolean }) {
  const cfg = {
    receita:      { bg: 'rgba(0,224,150,0.12)',   color: 'var(--success)', emoji: '↑' },
    despesa:      { bg: 'rgba(255,107,122,0.12)',  color: 'var(--danger)',  emoji: '↓' },
    transferencia:{ bg: 'rgba(108,142,245,0.12)', color: 'var(--accent)',  emoji: '⇄' },
  }
  const { bg, color, emoji } = cfg[tipo] ?? cfg.despesa
  return (
    <div className="relative flex-shrink-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
        style={{ background: cor ? `${cor}22` : bg, color: cor ?? color }}>
        {emoji}
      </div>
      {viaCartao && (
        <div
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center"
          title="Compra no cartão de crédito"
        >
          <CreditCard size={9} className="text-[var(--primary)]" />
        </div>
      )}
    </div>
  )
}
