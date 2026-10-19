import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useOrcamentos, useLancamentosEfetivos, useDeletarOrcamento } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL } from '../lib/utils'
import { Screen, FAB } from '../ui/Screen'
import { Card, Badge } from '../ui/primitives'
import { ProgressBar } from '../ui/finance'
import { EmptyState } from '../ui/feedback'

export function OrcamentosPage() {
  const navigate = useNavigate()
  const { filtroMes, filtroAno } = useStore()
  const { data: orcamentos = [], isLoading } = useOrcamentos(filtroMes, filtroAno)
  const { data: lancamentosMes = [] } = useLancamentosEfetivos(filtroMes, filtroAno)
  const deletar = useDeletarOrcamento()
  const [confirmando, setConfirmando] = useState<string | null>(null)

  const isPagamentoFatura = (tags?: string[]) => tags?.some(t => t.startsWith('fatura:')) ?? false

  const lista = orcamentos.map(o => {
    const gasto = lancamentosMes
      .filter(l => l.tipo === 'despesa' && l.categoria_id === o.categoria_id && !isPagamentoFatura(l.tags))
      .reduce((a, l) => a + l.valor, 0)
    const pct = o.valor_limite > 0 ? (gasto / o.valor_limite) * 100 : 0
    return { ...o, gasto, pct, restante: o.valor_limite - gasto }
  }).sort((a, b) => b.pct - a.pct)

  const totalLimite = lista.reduce((a, o) => a + o.valor_limite, 0)
  const totalGasto = lista.reduce((a, o) => a + o.gasto, 0)

  async function handleExcluir(id: string) {
    await deletar.mutateAsync(id)
    setConfirmando(null)
  }

  return (
    <Screen title="Orçamentos" subtitle="Limite de gastos por categoria">
      {isLoading && <p className="text-center text-sm text-[var(--text-muted)] py-8">Carregando...</p>}

      {!isLoading && lista.length === 0 && (
        <EmptyState
          variant="metas"
          title="Nenhum orçamento definido"
          description="Defina um limite de gasto mensal por categoria para acompanhar seus hábitos."
          action={<button type="button" onClick={() => navigate('/orcamentos/novo')} className="text-sm font-semibold text-[var(--primary)]">Criar orçamento</button>}
        />
      )}

      {lista.length > 0 && (
        <Card className="mb-4">
          <div className="flex justify-between text-sm font-mono mb-2">
            <span className={totalGasto > totalLimite ? 'text-[var(--danger)]' : 'text-[var(--primary)]'}>{formatBRL(totalGasto)}</span>
            <span className="text-[var(--text-muted)]">de {formatBRL(totalLimite)}</span>
          </div>
          <ProgressBar value={totalGasto} max={totalLimite} color={totalGasto > totalLimite ? 'var(--danger)' : 'var(--primary)'} />
          <p className="text-[10px] text-[var(--text-muted)] mt-2">Total orçado para este mês</p>
        </Card>
      )}

      <div className="space-y-3">
        {lista.map(o => (
          <Card key={o.id}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: o.categoria?.cor ?? 'var(--primary)' }} />
                <h3 className="font-semibold text-sm">{o.categoria?.nome ?? 'Categoria removida'}</h3>
                {o.pct >= 100 && <Badge variant="danger"><AlertTriangle size={10} className="inline mr-1" />Estourou</Badge>}
                {o.pct >= 70 && o.pct < 100 && <Badge variant="warning">Atenção</Badge>}
              </div>
              {confirmando === o.id ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleExcluir(o.id)} className="text-[11px] font-semibold text-[var(--danger)]">Excluir</button>
                  <button type="button" onClick={() => setConfirmando(null)} className="text-[11px] text-[var(--text-muted)]">Cancelar</button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmando(o.id)} aria-label="Excluir orçamento" className="text-[var(--text-subtle)] hover:text-[var(--danger)] transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div className="flex justify-between text-sm font-mono mb-2">
              <span className={o.pct >= 100 ? 'text-[var(--danger)]' : 'text-[var(--primary)]'}>{formatBRL(o.gasto)}</span>
              <span className="text-[var(--text-muted)]">de {formatBRL(o.valor_limite)}</span>
            </div>
            <ProgressBar value={o.gasto} max={o.valor_limite} color={o.pct >= 100 ? 'var(--danger)' : o.pct >= 70 ? 'var(--warning)' : (o.categoria?.cor ?? 'var(--primary)')} />
            <p className="text-[10px] text-[var(--text-muted)] mt-2">
              {o.restante >= 0 ? `Faltam ${formatBRL(o.restante)}` : `Estourou em ${formatBRL(Math.abs(o.restante))}`} · {Math.round(o.pct)}%
            </p>
          </Card>
        ))}
      </div>

      <FAB onClick={() => navigate('/orcamentos/novo')} label="Novo orçamento" />
    </Screen>
  )
}
