import { useMemo } from 'react'
import { Calendar, CreditCard, CheckCircle2, Clock, Check, X } from 'lucide-react'
import { useLancamentosGrupoParcela, usePagamentoFatura } from '../../hooks/useData'
import { formatBRL } from '../../lib/utils'
import { Card, Badge, Button } from '../../ui/primitives'
import { tagPagamentoFatura } from '../../lib/lancamentos'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useStore } from '../../lib/store'

export function HistoricoParcelamentoModal({
  open,
  onClose,
  grupoParcelaId,
  descricaoFallback,
}: {
  open: boolean
  onClose: () => void
  grupoParcelaId?: string | null
  descricaoFallback?: string
}) {
  const userId = useStore(s => s.userId)
  const { data: parcelas = [], isLoading } = useLancamentosGrupoParcela(grupoParcelaId)

  // Busca todas as faturas pagas do usuário para identificar quais parcelas já foram pagas
  const { data: faturasPagas = new Set<string>() } = useQuery({
    queryKey: ['faturas-pagas-tags', userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('tags')
        .eq('user_id', userId!)
        .not('tags', 'is', null)
      if (error) throw error

      const tagsPagas = new Set<string>()
      for (const row of data as { tags: string[] | null }[]) {
        for (const tag of row.tags ?? []) {
          if (tag.startsWith('fatura:')) tagsPagas.add(tag)
        }
      }
      return tagsPagas
    },
  })

  const resumo = useMemo(() => {
    let pagas = 0
    let confirmadas = 0
    let previstas = 0
    let valorTotal = 0

    const itens = parcelas.map(p => {
      valorTotal += p.valor
      const cartaoId = p.cartao_id
      const dataRef = p.data_vencimento_parcela || p.data
      const [anoStr, mesStr] = dataRef.split('-')
      const ano = parseInt(anoStr, 10)
      const mes = parseInt(mesStr, 10)

      const tagFatura = cartaoId ? tagPagamentoFatura(cartaoId, mes, ano) : ''
      const isPaga = cartaoId ? faturasPagas.has(tagFatura) : false

      let status: 'paga' | 'confirmada' | 'prevista'
      if (isPaga) {
        status = 'paga'
        pagas++
      } else if (p.efetivado) {
        status = 'confirmada'
        confirmadas++
      } else {
        status = 'prevista'
        previstas++
      }

      return {
        ...p,
        mesReferencia: mes,
        anoReferencia: ano,
        statusCalculado: status,
      }
    })

    return {
      itens,
      pagas,
      confirmadas,
      previstas,
      totalItens: parcelas.length,
      valorTotal,
    }
  }, [parcelas, faturasPagas])

  if (!open) return null

  const primeiraParcela = parcelas[0]
  const tituloCompra = primeiraParcela?.descricao?.replace(/\s*\(\d+\/\d+\)/, '') || descricaoFallback || 'Compra parcelada'
  const nomeCartao = primeiraParcela?.cartao?.nome || 'Cartão de crédito'
  const dataCompraOriginal = primeiraParcela?.data

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-lg max-h-[90vh] flex flex-col animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                <CreditCard size={18} />
              </span>
              <h2 className="text-base font-bold truncate text-[var(--text)]">{tituloCompra}</h2>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2 flex-wrap">
              <span>{nomeCartao}</span>
              {dataCompraOriginal && (
                <>
                  <span>•</span>
                  <span>Compra em {new Date(`${dataCompraOriginal}T12:00:00`).toLocaleDateString('pt-BR')}</span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Resumo e Indicadores */}
        <div className="py-3 border-b border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-muted)] font-medium">Valor total do parcelamento:</span>
            <span className="font-mono font-bold text-sm text-[var(--text)]">{formatBRL(resumo.valorTotal)}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold text-[11px]">
              <Check size={12} /> {resumo.pagas} Paga{resumo.pagas !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 font-semibold text-[11px]">
              <CheckCircle2 size={12} /> {resumo.confirmadas} Na fatura
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-semibold text-[11px]">
              <Clock size={12} /> {resumo.previstas} Prevista{resumo.previstas !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Lista de Parcelas */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {isLoading ? (
            <p className="text-center py-8 text-xs text-[var(--text-muted)]">Carregando parcelas...</p>
          ) : resumo.itens.length === 0 ? (
            <p className="text-center py-8 text-xs text-[var(--text-muted)]">Nenhuma parcela encontrada para este grupo.</p>
          ) : (
            resumo.itens.map(item => {
              const configStatus = {
                paga: { label: 'Paga', variant: 'success' as const, bg: 'bg-emerald-500/10 text-emerald-400' },
                confirmada: { label: 'Confirmada na fatura', variant: 'default' as const, bg: 'bg-blue-500/10 text-blue-400' },
                prevista: { label: 'Prevista', variant: 'warning' as const, bg: 'bg-amber-500/10 text-amber-400' },
              }[item.statusCalculado]

              const temOfx = item.tags?.some(t => t.startsWith('ofx:'))

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-muted)] border border-[var(--border)] text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text)]">
                        Parcela {item.parcela_atual}/{item.total_parcelas}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${configStatus.bg}`}>
                        {configStatus.label}
                      </span>
                      {temOfx && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] font-mono">
                          OFX
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Cobrança: {item.data_vencimento_parcela ? new Date(`${item.data_vencimento_parcela}T12:00:00`).toLocaleDateString('pt-BR') : 'Data não definida'}
                      {' · '}
                      Fatura {String(item.mesReferencia).padStart(2, '0')}/{item.anoReferencia}
                    </p>
                  </div>

                  <span className="font-mono font-bold text-sm text-[var(--danger)] tabular-nums flex-shrink-0">
                    -{formatBRL(item.valor)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[var(--border)] flex justify-end">
          <Button variant="secondary" onClick={onClose} size="sm">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
