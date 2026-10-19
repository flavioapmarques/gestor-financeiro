import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Pencil, Trash2, CreditCard, CircleCheck, Upload } from 'lucide-react'

import { useDeletarLancamento, useLancamentos, useBancos } from '../hooks/useData'
import { isPagamentoFatura } from '../lib/lancamentos'
import { useStore } from '../lib/store'
import { formatBRL, mesAnterior, proximoMes, nomeMes } from '../lib/utils'
import type { Lancamento } from '../lib/supabase'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'
import { PagarLancamentoModal } from '../components/lancamentos/PagarLancamentoModal'
import { TxIcon } from '../ui/finance'
import { FAB, PageHeader } from '../ui/Screen'

type FiltroTipo = 'todos' | 'receita' | 'despesa' | 'parcelado' | 'recorrente' | 'transferencia'

function labelData(dataStr: string): string {
  const d = parseISO(dataStr)
  if (isToday(d)) return 'Hoje'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "EEEE, d 'de' MMMM", { locale: ptBR })
}

function agruparPorData(lancamentos: Lancamento[]) {
  const map = new Map<string, Lancamento[]>()
  for (const l of lancamentos) {
    const lista = map.get(l.data) ?? []; lista.push(l); map.set(l.data, lista)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([data, itens]) => ({ data, label: labelData(data), itens }))
}

function LancamentoRow({ lancamento, onEditar, onPagar }: { lancamento: Lancamento; onEditar: () => void; onPagar: () => void }) {
  const deletar = useDeletarLancamento()
  const [confirmando, setConfirmando] = useState(false)

  async function handleDeletar() {
    if (lancamento.grupo_parcela_id) {
      setConfirmando(true)
      return
    }
    await deletar.mutateAsync({ id: lancamento.id })
  }

  async function deletarSoEsta() {
    await deletar.mutateAsync({ id: lancamento.id })
    setConfirmando(false)
  }

  async function deletarTodas() {
    await deletar.mutateAsync({ id: lancamento.id, deletarFuturas: true, grupoParcela: lancamento.grupo_parcela_id! })
    setConfirmando(false)
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors group">
        <TxIcon tipo={lancamento.tipo} cor={lancamento.categoria?.cor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{lancamento.descricao}</p>
            {isPagamentoFatura(lancamento.tags) && (
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex-shrink-0">
                <CreditCard size={9} /> Fatura
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {lancamento.categoria?.nome ?? (lancamento.tipo==='transferencia' ? 'Transferência' : '—')}
            {lancamento.parcelado && ` · ${lancamento.parcela_atual}/${lancamento.total_parcelas}x`}
            {lancamento.cartao && ` · ${lancamento.cartao.nome}`}
            {lancamento.banco && ` · ${lancamento.banco.instituicao}`}
            {!lancamento.efetivado && <span className="text-[var(--warning)]"> · Pendente</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {!lancamento.efetivado && lancamento.tipo !== 'transferencia' && (
            <button type="button" onClick={onPagar} aria-label="Pagar"
              className="p-1.5 rounded-lg hover:bg-[var(--success)]/10 text-[var(--warning)] hover:text-[var(--success)] transition-colors">
              <CircleCheck size={13} />
            </button>
          )}
          <button type="button" onClick={onEditar} aria-label="Editar"
            className="p-1.5 rounded-lg hover:bg-[var(--primary-soft)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            <Pencil size={13} />
          </button>
          <button type="button" onClick={handleDeletar} aria-label="Excluir" disabled={deletar.isPending}
            className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50">
            <Trash2 size={13} />
          </button>
        </div>
        <p className={`text-sm font-mono font-bold tabular-nums flex-shrink-0 ml-1 ${
          lancamento.tipo==='receita' ? 'text-[var(--success)]' :
          lancamento.tipo==='transferencia' ? 'text-[var(--accent)]' : 'text-[var(--danger)]'
        }`}>
          {lancamento.tipo==='receita' ? '+' : lancamento.tipo==='transferencia' ? '' : '-'}{formatBRL(lancamento.valor)}
        </p>
      </div>

      {/* Modal de confirmação de exclusão de parcelas */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-5 w-full max-w-sm animate-slide-up">
            <p className="font-semibold mb-1">Excluir parcela?</p>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Este lançamento é a parcela {lancamento.parcela_atual}/{lancamento.total_parcelas}. Deseja excluir só esta ou todas as parcelas restantes?
            </p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={deletarSoEsta} disabled={deletar.isPending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border)] transition-colors disabled:opacity-50">
                Excluir só esta ({lancamento.parcela_atual}ª)
              </button>
              <button type="button" onClick={deletarTodas} disabled={deletar.isPending}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--danger)] text-white hover:opacity-90 transition-all disabled:opacity-50">
                Excluir todas as parcelas
              </button>
              <button type="button" onClick={() => setConfirmando(false)}
                className="w-full py-2.5 rounded-xl text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function Lancamentos() {
  const navigate = useNavigate()
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const { data: lancamentos = [], isLoading, isError } = useLancamentos(filtroMes, filtroAno)
  const { data: bancos = [] } = useBancos()
  const [filtro, setFiltro] = useState<FiltroTipo>('todos')
  const [filtroBanco, setFiltroBanco] = useState<string>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState<Lancamento | null>(null)
  const [lancamentoAPagar, setLancamentoAPagar] = useState<Lancamento | null>(null)

  const lancamentosFiltrados = useMemo(() => lancamentos
    .filter(l => !l.cartao_id) // cartão só aparece no extrato do cartão
    .filter(l => {
      if (filtro==='receita') return l.tipo==='receita'
      if (filtro==='despesa') return l.tipo==='despesa'
      if (filtro==='transferencia') return l.tipo==='transferencia'
      if (filtro==='parcelado') return l.parcelado
      if (filtro==='recorrente') return l.recorrente
      return true
    })
    .filter(l => {
      if (filtroBanco === 'todos') return true
      return l.banco_id === filtroBanco || l.banco_destino_id === filtroBanco
    }), [lancamentos, filtro, filtroBanco])

  const grupos = useMemo(() => agruparPorData(lancamentosFiltrados), [lancamentosFiltrados])

  const totais = useMemo(() => {
    const r = lancamentosFiltrados.filter(l=>l.tipo==='receita').reduce((a,l)=>a+l.valor,0)
    const d = lancamentosFiltrados.filter(l=>l.tipo==='despesa').reduce((a,l)=>a+l.valor,0)
    return { receitas: r, despesas: d, saldo: r - d }
  }, [lancamentosFiltrados])

  function mudarMes(delta: -1|1) {
    const fn = delta===-1 ? mesAnterior : proximoMes
    const { mes, ano } = fn(filtroMes, filtroAno)
    setFiltroMes(mes); setFiltroAno(ano)
  }

  const filtros: { id: FiltroTipo; label: string }[] = [
    { id: 'todos',         label: 'Todos' },
    { id: 'despesa',       label: 'Despesas' },
    { id: 'receita',       label: 'Receitas' },
    { id: 'transferencia', label: 'Transferências' },
    { id: 'parcelado',     label: 'Parcelado' },
    { id: 'recorrente',    label: 'Recorrente' },
  ]

  return (
    <div className="min-h-full bg-[var(--bg)] animate-fade-in pb-28 lg:pb-8">
      <div className="px-4 max-w-4xl mx-auto">
        {(() => {
          const hoje = new Date()
          const noMesAtual = filtroMes === hoje.getMonth() + 1 && filtroAno === hoje.getFullYear()
          return (
            <PageHeader title="Lançamentos"
              rightAction={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/importar-ofx')}
                    aria-label="Importar extrato OFX"
                    title="Importar extrato OFX"
                    className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors flex-shrink-0"
                  >
                    <Upload size={16} />
                  </button>
                  {!noMesAtual && (
                    <button type="button" onClick={() => { setFiltroMes(hoje.getMonth() + 1); setFiltroAno(hoje.getFullYear()) }}
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex-shrink-0">
                      Hoje
                    </button>
                  )}
                  <div className="flex items-center gap-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl px-1 py-1">
                    <button type="button" onClick={()=>mudarMes(-1)} aria-label="Mês anterior"
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                      <ChevronLeft size={17} />
                    </button>
                    <span className="text-xs font-semibold min-w-[110px] text-center capitalize px-1">
                      {nomeMes(filtroMes, filtroAno)}
                    </span>
                    <button type="button" onClick={()=>mudarMes(1)} aria-label="Próximo mês"
                      className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </div>
              }
            />
          )
        })()}

        {/* Totais */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Receitas', value: `+${formatBRL(totais.receitas)}`, color: 'var(--success)' },
            { label: 'Despesas', value: `-${formatBRL(totais.despesas)}`, color: 'var(--danger)' },
            { label: 'Saldo',    value: formatBRL(totais.saldo),          color: totais.saldo>=0 ? 'var(--primary)' : 'var(--danger)' },
          ].map(item => (
            <div key={item.label} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider mb-1">{item.label}</p>
              <p className="text-sm font-bold font-mono tabular-nums" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Aviso discreto */}
        <div className="flex items-center gap-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl px-3 py-2.5 mb-4">
          <CreditCard size={14} className="text-[var(--accent)] flex-shrink-0" />
          <p className="text-[11px] text-[var(--accent)] font-medium">Compras no cartão de crédito aparecem no extrato de cada cartão.</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-2 -mx-1 px-1">
          {filtros.map(f => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                filtro===f.id
                  ? 'bg-[var(--primary)] text-white shadow-sm shadow-[var(--primary)]/30'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {bancos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4 -mx-1 px-1">
            <button type="button" onClick={() => setFiltroBanco('todos')}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                filtroBanco==='todos'
                  ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40'
              }`}>
              Todos os bancos
            </button>
            {bancos.map(b => (
              <button key={b.id} type="button" onClick={() => setFiltroBanco(b.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  filtroBanco===b.id
                    ? 'bg-[var(--accent)] text-white shadow-sm shadow-[var(--accent)]/30'
                    : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/40'
                }`}>
                {b.nome}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        {isLoading && (
          <div className="space-y-3">
            {[1,2,3,4].map(i=><div key={i} className="h-14 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] animate-pulse-soft"/>)}
          </div>
        )}
        {isError && <p className="text-center text-[var(--danger)] text-sm py-12">Erro ao carregar lançamentos</p>}
        {!isLoading && !isError && grupos.length===0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-[var(--text-muted)] text-sm font-medium">Nenhum lançamento neste período</p>
            <p className="text-[var(--text-subtle)] text-xs mt-1">Toque em + para adicionar</p>
          </div>
        )}

        <div className="space-y-5">
          {grupos.map(grupo => (
            <section key={grupo.data}>
              <p className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2 capitalize">
                {grupo.label}
              </p>
              <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden divide-y divide-[var(--border)]" style={{ boxShadow: 'var(--shadow-card)' }}>
                {grupo.itens.map(l => (
                  <LancamentoRow key={l.id} lancamento={l}
                    onEditar={() => { setLancamentoSelecionado(l); setModalAberto(true) }}
                    onPagar={() => setLancamentoAPagar(l)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <FAB onClick={() => { setLancamentoSelecionado(null); setModalAberto(true) }} />

      <FormLancamentoModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setLancamentoSelecionado(null) }}
        defaultTipo={null}
        lancamento={lancamentoSelecionado}
      />

      {lancamentoAPagar && (
        <PagarLancamentoModal
          open={!!lancamentoAPagar}
          onClose={() => setLancamentoAPagar(null)}
          lancamento={lancamentoAPagar}
        />
      )}
    </div>
  )
}
