import { useEffect, useRef } from 'react'
import {
  TrendingDown,
  TrendingUp,
  CreditCard,
  ArrowRightLeft,
  Sparkles,
  ChevronRight,
  X,
} from 'lucide-react'

export type TipoLancamentoOpcao = 'receita' | 'despesa' | 'cartao' | 'transferencia' | 'voz'

interface NovoLancamentoPopoverProps {
  open: boolean
  onClose: () => void
  onSelect: (tipo: TipoLancamentoOpcao) => void
}

const OPCOES: {
  tipo: TipoLancamentoOpcao
  label: string
  descricao: string
  icon: typeof TrendingDown
  iconColor: string
  iconBg: string
}[] = [
  {
    tipo: 'despesa',
    label: 'Despesa',
    descricao: 'Saída de conta bancária ou dinheiro',
    icon: TrendingDown,
    iconColor: 'text-[var(--danger)]',
    iconBg: 'bg-[var(--danger)]/15',
  },
  {
    tipo: 'receita',
    label: 'Receita',
    descricao: 'Entrada, salário ou rendimento',
    icon: TrendingUp,
    iconColor: 'text-[var(--success)]',
    iconBg: 'bg-[var(--success)]/15',
  },
  {
    tipo: 'cartao',
    label: 'Despesa de Cartão',
    descricao: 'Compra a ser cobrada na fatura',
    icon: CreditCard,
    iconColor: 'text-[#9D4EDD]',
    iconBg: 'bg-[#9D4EDD]/15',
  },
  {
    tipo: 'transferencia',
    label: 'Transferência',
    descricao: 'Movimentação entre contas bancárias',
    icon: ArrowRightLeft,
    iconColor: 'text-[var(--accent)]',
    iconBg: 'bg-[var(--accent)]/15',
  },
]

export function NovoLancamentoPopover({
  open,
  onClose,
  onSelect,
}: NovoLancamentoPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Fecha ao pressionar ESC
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop transparente/suave para capturar clique fora */}
      <div
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover flutuante responsivo */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Opções de novo lançamento"
        className="fixed z-50 w-[310px] max-w-[calc(100vw-32px)] bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl shadow-2xl p-2.5 animate-slide-up
                   bottom-24 left-1/2 -translate-x-1/2
                   lg:bottom-24 lg:right-8 lg:left-auto lg:translate-x-0"
        style={{
          boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--border)',
        }}
      >
        {/* Cabeçalho discreto */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Novo lançamento
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Lista vertical de opções principais */}
        <div className="space-y-1">
          {OPCOES.map(op => {
            const Icon = op.icon
            return (
              <button
                key={op.tipo}
                type="button"
                onClick={() => {
                  onSelect(op.tipo)
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-[var(--bg-muted)] active:scale-[0.98] transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 ${op.iconBg} ${op.iconColor}`}
                >
                  <Icon size={18} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                    {op.label}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                    {op.descricao}
                  </p>
                </div>
                <ChevronRight
                  size={14}
                  className="text-[var(--text-muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                />
              </button>
            )
          })}
        </div>

        {/* Opção Inteligente por Voz (IA) em destaque */}
        <div className="border-t border-[var(--border)] mt-1.5 pt-1.5">
          <button
            type="button"
            onClick={() => {
              onSelect('voz')
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-[var(--primary-soft)] active:scale-[0.98] transition-all group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm transition-transform group-hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, #7928CA 100%)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--primary)] transition-colors leading-tight">
                  Lançar por Voz
                </p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] uppercase tracking-wider">
                  IA
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                Fale naturalmente sua despesa
              </p>
            </div>
            <ChevronRight
              size={14}
              className="text-[var(--text-muted)] opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0"
            />
          </button>
        </div>
      </div>
    </>
  )
}
