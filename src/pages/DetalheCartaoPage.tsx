import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Edit, FileText, CheckCircle2, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Lock } from 'lucide-react'
import { useCartoes, useLancamentosCartao, usePagamentoFatura, useDeletarLancamento, useLimiteUtilizadoCartao } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL, mesAnterior, proximoMes, nomeMes } from '../lib/utils'
import { CreditCardVisual, ProgressBar, TxIcon } from '../ui/finance'
import { Button, Card, SectionTitle, Badge } from '../ui/primitives'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'
import { ConfirmarExclusaoCartaoModal } from '../components/cartoes/ConfirmarExclusaoCartaoModal'
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

export function DetalheCartaoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const { data: cartoes = [] } = useCartoes()
  const cartao = cartoes.find(c => c.id === id)
  const { data: lancamentos = [] } = useLancamentosCartao(id ?? '', filtroMes, filtroAno)
  const { data: pagamento } = usePagamentoFatura(id ?? '', filtroMes, filtroAno)
  const { data: limiteUtilizado = 0 } = useLimiteUtilizadoCartao(cartao)
  const [modalAberto, setModalAberto] = useState(false)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<Lancamento | null>(null)
  const [excluindo, setExcluindo] = useState<Lancamento | null>(null)
  const [modalExcluirCartaoAberto, setModalExcluirCartaoAberto] = useState(false)

  if (!cartao) return (
    <div className="min-h-full bg-[var(--bg)] flex flex-col items-center justify-center gap-4 p-8">
      <p className="text-[var(--text-muted)]">Cartão não encontrado</p>
      <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
    </div>
  )

  const usado = lancamentos.reduce((a, l) => a + l.valor, 0)
  const paga = !!pagamento
  const disponivel = Math.max(0, cartao.limite - limiteUtilizado)

  function mudarMes(delta: -1 | 1) {
    const fn = delta === -1 ? mesAnterior : proximoMes
    const next = fn(filtroMes, filtroAno)
    setFiltroMes(next.mes)
    setFiltroAno(next.ano)
  }

  const hoje = new Date()
  const noMesAtual = filtroMes === hoje.getMonth() + 1 && filtroAno === hoje.getFullYear()

  return (
    <div className="min-h-full bg-[var(--bg)] animate-fade-in pb-28 lg:pb-8">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar"
          className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{cartao.nome}</h1>
          <p className="text-xs text-[var(--text-muted)] truncate">{cartao.banco ?? cartao.bandeira} · {nomeMes(filtroMes, filtroAno)}</p>
        </div>
        <button type="button" onClick={() => navigate(`/cartoes/${cartao.id}/editar`)}
          className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors" aria-label="Editar" title="Editar cartão">
          <Edit size={16} />
        </button>
        <button type="button" onClick={() => setModalExcluirCartaoAberto(true)}
          className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/15 transition-colors" aria-label="Excluir cartão" title="Excluir cartão">
          <Trash2 size={16} />
        </button>
      </header>


      <div className="px-4 pt-4 max-w-2xl mx-auto">

        {/* Seletor de mês */}
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

        {/* Cartão visual */}
        <div className="mb-5">
          <CreditCardVisual nome={cartao.nome} banco={cartao.banco ?? cartao.nome} bandeira={cartao.bandeira}
            limite={cartao.limite} usado={limiteUtilizado} cor={cartao.cor} />
        </div>

        {/* Info da fatura em grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Fatura atual</p>
            <p className="text-2xl font-bold font-mono text-[var(--danger)]">{formatBRL(usado)}</p>
            {paga
              ? <Badge variant="success" ><CheckCircle2 size={10}/>Paga</Badge>
              : usado > 0 ? <Badge variant="warning">Em aberto</Badge>
              : null}
          </div>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">Disponível</p>
            <p className="text-2xl font-bold font-mono text-[var(--success)]">{formatBRL(disponivel)}</p>
            <p className="text-[11px] text-[var(--text-subtle)] mt-1">de {formatBRL(cartao.limite)}</p>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Fechamento', value: `Dia ${cartao.dia_fechamento}` },
            { label: 'Vencimento', value: `Dia ${cartao.dia_vencimento}`, highlight: true },
            { label: 'Compras',    value: `${lancamentos.length}` },
          ].map(item => (
            <div key={item.label} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3 text-center" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1">{item.label}</p>
              <p className={`text-base font-bold ${item.highlight ? 'text-[var(--warning)]' : ''}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar uso */}
        <Card className="mb-5">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-[var(--text-muted)]">Limite utilizado</span>
            <span className="font-semibold">{cartao.limite > 0 ? ((limiteUtilizado/cartao.limite)*100).toFixed(0) : 0}%</span>
          </div>
          <ProgressBar value={limiteUtilizado} max={cartao.limite} color={limiteUtilizado > cartao.limite ? 'var(--danger)' : 'var(--primary)'} />
          <p className="text-[10px] text-[var(--text-muted)] mt-2">Inclui a fatura atual e parcelas futuras já compromissadas; some daqui assim que a fatura correspondente é paga.</p>
          <Button className="w-full mt-4" onClick={() => navigate(`/cartoes/${id}/fatura`)}>
            <FileText size={16} /> {paga ? 'Ver fatura paga' : 'Ver fatura e pagar'}
          </Button>
        </Card>

        {/* Lançamentos da fatura */}
        <div className="flex items-center justify-between mb-3">
          <SectionTitle title="Compras nesta fatura" />
          {paga ? (
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Lock size={12} /> Fatura paga
            </span>
          ) : (
            <button type="button" onClick={() => { setLancamentoSelecionado(null); setModalAberto(true) }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-80 transition-opacity">
              <Plus size={14} /> Nova despesa
            </button>
          )}
        </div>
        {paga && (
          <p className="text-[11px] text-[var(--text-muted)] mb-3 -mt-2">
            As compras abaixo estão bloqueadas para edição. Para alterar algo, reabra a fatura na tela de fatura.
          </p>
        )}

        <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {lancamentos.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma compra neste mês</p>
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
                        <button type="button" onClick={() => { setLancamentoSelecionado(l); setModalAberto(true) }}
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
        </div>
      </div>

      <FormLancamentoModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setLancamentoSelecionado(null) }}
        defaultTipo="despesa"
        defaultCartaoId={id}
        lancamento={lancamentoSelecionado}
      />

      {excluindo && (
        <ConfirmarExclusaoModal
          lancamento={excluindo}
          onClose={() => setExcluindo(null)}
        />
      )}

      {cartao && (
        <ConfirmarExclusaoCartaoModal
          open={modalExcluirCartaoAberto}
          cartao={cartao}
          onClose={() => setModalExcluirCartaoAberto(false)}
          onSuccess={() => navigate('/cartoes')}
        />
      )}
    </div>
  )
}

