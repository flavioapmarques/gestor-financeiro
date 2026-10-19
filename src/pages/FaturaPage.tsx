import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Check, CheckCircle2, ChevronLeft, ChevronRight, Lock, RotateCcw, Pencil, Trash2, Plus } from 'lucide-react'
import { useCartoes, useLancamentosCartao, useFaturaCartao, usePagamentoFatura, useReabrirFatura, useDeletarLancamento } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL, mesAnterior, proximoMes, nomeMes } from '../lib/utils'
import { Screen } from '../ui/Screen'
import { Button, Card, SectionTitle, Badge } from '../ui/primitives'
import { ProgressBar, TxIcon } from '../ui/finance'
import { PagarFaturaModal } from '../components/cartoes/PagarFaturaModal'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'
import type { Lancamento } from '../lib/supabase'

function ConfirmarExclusaoModal({ lancamento, onClose }: { lancamento: Lancamento; onClose: () => void }) {
  const deletar = useDeletarLancamento()
  const [erro, setErro] = useState('')

  async function deletarSo() {
    try {
      await deletar.mutateAsync({ id: lancamento.id })
      onClose()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  async function deletarTodas() {
    try {
      await deletar.mutateAsync({ id: lancamento.id, deletarFuturas: true, grupoParcela: lancamento.grupo_parcela_id! })
      onClose()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm animate-slide-up">
        <p className="font-bold text-base mb-1">Excluir lançamento?</p>
        {erro && <p className="text-xs text-[var(--danger)] mb-3">{erro}</p>}
        {lancamento.grupo_parcela_id ? (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Este lançamento é a parcela <strong>{lancamento.parcela_atual}/{lancamento.total_parcelas}</strong> de <em>{lancamento.descricao}</em>.
              O que deseja excluir?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={deletarSo} disabled={deletar.isPending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border-strong)] transition-colors disabled:opacity-50">
                Só esta parcela ({lancamento.parcela_atual}ª)
              </button>
              <button type="button" onClick={deletarTodas} disabled={deletar.isPending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--danger)] text-white hover:opacity-90 transition-all disabled:opacity-50">
                Todas as parcelas do grupo
              </button>
              <button type="button" onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Excluir <em>{lancamento.descricao}</em> de {formatBRL(lancamento.valor)}? Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={deletarSo} disabled={deletar.isPending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--danger)] text-white hover:opacity-90 transition-all disabled:opacity-50">
                {deletar.isPending ? 'Excluindo…' : 'Excluir'}
              </button>
              <button type="button" onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function FaturaPage() {
  const { id } = useParams()
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const [modalPagar, setModalPagar] = useState(false)
  const [confirmandoReabrir, setConfirmandoReabrir] = useState(false)
  const [modalLancamento, setModalLancamento] = useState(false)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<Lancamento | null>(null)
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null)

  const reabrirFatura = useReabrirFatura()
  const { data: cartoes = [] } = useCartoes()
  const cartao = cartoes.find(c => c.id === id)
  const { data: fatura } = useFaturaCartao(id ?? '', filtroMes, filtroAno)
  const { data: lancamentos = [] } = useLancamentosCartao(id ?? '', filtroMes, filtroAno)
  const { data: pagamento } = usePagamentoFatura(id ?? '', filtroMes, filtroAno)

  if (!cartao) {
    return <Screen title="Fatura" onBack><p className="text-center py-12 text-[var(--text-muted)]">Cartão não encontrado</p></Screen>
  }

  const total = Number(fatura?.total_fatura ?? lancamentos.reduce((a, l) => a + l.valor, 0))
  const paga = !!pagamento
  const parcelasFuturas = lancamentos.filter(l => l.parcelado && l.total_parcelas && l.parcela_atual! < l.total_parcelas)

  function mudarMes(delta: -1 | 1) {
    const fn = delta === -1 ? mesAnterior : proximoMes
    const next = fn(filtroMes, filtroAno)
    setFiltroMes(next.mes)
    setFiltroAno(next.ano)
  }

  const hoje = new Date()
  const noMesAtual = filtroMes === hoje.getMonth() + 1 && filtroAno === hoje.getFullYear()

  return (
    <Screen title="Fatura" subtitle={`${cartao.nome} · Vence dia ${cartao.dia_vencimento}`} onBack>
      <div className="flex items-center justify-between mb-4 bg-[var(--bg-muted)] rounded-xl px-3 py-2">
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">{nomeMes(filtroMes, filtroAno)}</span>
          {!noMesAtual && (
            <button type="button" onClick={() => { setFiltroMes(hoje.getMonth() + 1); setFiltroAno(hoje.getFullYear()) }}
              className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
              Hoje
            </button>
          )}
        </div>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
          <ChevronRight size={18} />
        </button>
      </div>

      <Card className={`mb-4 text-center !p-6 ${paga ? 'border-[var(--success)]/40' : ''}`}>
        <div className="flex items-center justify-center gap-2 mb-2">
          {paga ? (
            <Badge variant="success"><CheckCircle2 size={12} className="inline mr-1" />Paga</Badge>
          ) : total > 0 ? (
            <Badge variant="warning">Em aberto</Badge>
          ) : (
            <Badge variant="default">Sem movimentação</Badge>
          )}
        </div>
        <p className="text-xs text-[var(--text-muted)] uppercase">Valor total</p>
        <p className="text-3xl font-bold font-mono mt-1">{formatBRL(total)}</p>
        <p className="text-xs text-[var(--text-muted)] mt-2">{fatura?.qtd_lancamentos ?? lancamentos.length} lançamento(s)</p>
        {paga && pagamento && (
          <p className="text-xs text-[var(--success)] mt-2">
            Pago em {new Date(pagamento.data + 'T12:00:00').toLocaleDateString('pt-BR')}
            {pagamento.banco && ` · ${pagamento.banco.instituicao}`}
          </p>
        )}
        <div className="mt-4"><ProgressBar value={total} max={cartao.limite} color={paga ? 'var(--success)' : 'var(--primary)'} /></div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <SectionTitle title="Compras nesta fatura" />
        {paga ? (
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <Lock size={12} /> Fatura paga
          </span>
        ) : (
          <button type="button" onClick={() => { setLancamentoSelecionado(null); setModalLancamento(true) }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-80 transition-opacity">
            <Plus size={14} /> Nova despesa
          </button>
        )}
      </div>

      <Card padding="none" className="mb-4 overflow-hidden">
        {lancamentos.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--text-muted)]">Fatura vazia</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {lancamentos.map(l => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors group">
                <TxIcon tipo="despesa" cor={l.categoria?.cor} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{l.descricao}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {l.data_vencimento_parcela ?? l.data}
                    {l.parcelado && ` · ${l.parcela_atual}/${l.total_parcelas}x`}
                    {l.categoria && ` · ${l.categoria.nome}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  {paga ? (
                    <span title="Fatura paga — reabra para editar" className="p-1.5 text-[var(--text-subtle)]">
                      <Lock size={13} />
                    </span>
                  ) : (
                    <>
                      <button type="button" onClick={() => { setLancamentoSelecionado(l); setModalLancamento(true) }}
                        aria-label="Editar"
                        className="p-1.5 rounded-lg hover:bg-[var(--primary-soft)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => setExcluindo(l)}
                        aria-label="Excluir"
                        className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
                <span className="font-mono text-sm font-bold text-[var(--danger)] tabular-nums flex-shrink-0">
                  -{formatBRL(l.valor)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {parcelasFuturas.length > 0 && (
        <>
          <SectionTitle title="Parcelas em andamento" />
          <Card className="mb-6 text-sm text-[var(--text-muted)] space-y-2">
            {parcelasFuturas.map(l => (
              <p key={l.id}>{l.descricao} — {l.parcela_atual}/{l.total_parcelas}</p>
            ))}
          </Card>
        </>
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled><Download size={16} /> PDF</Button>
        {paga ? (
          confirmandoReabrir ? (
            <div className="flex-1 flex gap-2">
              <Button
                className="flex-1"
                variant="danger"
                loading={reabrirFatura.isPending}
                onClick={async () => {
                  if (pagamento) {
                    await reabrirFatura.mutateAsync(pagamento.id)
                    setConfirmandoReabrir(false)
                  }
                }}
              >
                Confirmar
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => setConfirmandoReabrir(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button className="flex-1" variant="secondary" onClick={() => setConfirmandoReabrir(true)}>
              <RotateCcw size={16} /> Reabrir fatura
            </Button>
          )
        ) : (
          <Button className="flex-1" onClick={() => setModalPagar(true)} disabled={total <= 0}>
            <Check size={16} /> Pagar fatura
          </Button>
        )}
      </div>
      {paga && (
        <p className="text-[11px] text-[var(--text-muted)] mt-2 flex items-center gap-1.5">
          <Lock size={11} /> Fatura paga: as compras estão bloqueadas para edição. Reabra a fatura para poder alterá-las.
        </p>
      )}

      <PagarFaturaModal
        open={modalPagar}
        onClose={() => setModalPagar(false)}
        cartaoId={cartao.id}
        cartaoNome={cartao.nome}
        mes={filtroMes}
        ano={filtroAno}
        valor={total}
        bancoPadraoId={cartao.banco_pagamento_id}
      />

      <FormLancamentoModal
        open={modalLancamento}
        onClose={() => { setModalLancamento(false); setLancamentoSelecionado(null) }}
        defaultTipo="despesa"
        defaultCartaoId={cartao.id}
        lancamento={lancamentoSelecionado}
      />

      {excluindo && (
        <ConfirmarExclusaoModal
          lancamento={excluindo}
          onClose={() => setExcluindo(null)}
        />
      )}
    </Screen>
  )
}
