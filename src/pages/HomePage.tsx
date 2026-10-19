import { useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bell, Search, TrendingUp, TrendingDown, CreditCard, Plus, BarChart2, Calendar, Sparkles, Tags, Landmark, ArrowRightLeft, ChevronRight, PiggyBank, Eye, EyeOff } from 'lucide-react'
import { useBancos, useLancamentos, useLancamentosEfetivos, useCartoes, useEvolucaoMensal, useResumoDashboard, useMetas, useOrcamentos } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL, formatBRLOuOculto, subtrairMeses } from '../lib/utils'
import { gerarNotificacoes, gerarResumoMensal } from '../lib/alertas'
import { Card, SectionTitle } from '../ui/primitives'
import { QuickAction, MoneyDisplay, TxIcon } from '../ui/finance'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'

const EvolucaoMensalCard = lazy(() => import('../components/home/EvolucaoMensalCard'))

export function HomePage() {
  const navigate = useNavigate()
  const [modalAberto, setModalAberto] = useState(false)
  const [defaultTipo, setDefaultTipo] = useState<'receita' | 'despesa' | 'transferencia' | null>(null)
  const { filtroMes, filtroAno, valoresOcultos, toggleValoresOcultos } = useStore()
  const { data: bancos = [] } = useBancos()
  const { data: cartoes = [] } = useCartoes()
  const { data: lancamentos = [], isLoading } = useLancamentos(filtroMes, filtroAno)
  const { data: lancamentosEfetivos = [] } = useLancamentosEfetivos(filtroMes, filtroAno)
  const { data: evolucao = [] } = useEvolucaoMensal()
  const { data: resumo = [] } = useResumoDashboard(filtroMes, filtroAno)
  const { data: metas = [] } = useMetas()
  const { data: orcamentos = [] } = useOrcamentos(filtroMes, filtroAno)
  const notificacoes = gerarNotificacoes({ cartoes, bancos, metas, lancamentosMes: lancamentosEfetivos, orcamentos })
  const alertasHome = notificacoes.slice(0, 3)
  const naoLidas = notificacoes.length
  const resumoMensal = gerarResumoMensal({ lancamentosMes: lancamentosEfetivos, cartoes, metas, orcamentos })

  const saldoTotal = bancos.reduce((a, c) => a + (c.saldo_atual ?? c.saldo_inicial), 0)
  // Totais usam o mês efetivo (mês em que a fatura é paga), pra bater com o gráfico de
  // evolução e os Relatórios — compra no cartão em 10/06 com fatura em 10/07 conta em julho.
  const receitas = lancamentosEfetivos.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const despesas = lancamentosEfetivos.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0)
  // Lista de "últimos lançamentos" continua pela data real (é sobre atividade recente, não sobre o mês da fatura)
  const ultimos = lancamentos.slice(0, 6)

  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const hoje = new Date()
    const { ano, mes } = subtrairMeses(hoje.getFullYear(), hoje.getMonth() + 1, 5 - i)
    const prefix = `${ano}-${String(mes).padStart(2, '0')}`
    const despMes = evolucao.filter(l => l.tipo==='despesa' && l.mes === prefix).reduce((s,l)=>s+Number(l.valor),0)
    const recMes  = evolucao.filter(l => l.tipo==='receita'  && l.mes === prefix).reduce((s,l)=>s+Number(l.valor),0)
    return { m: mesesNomes[mes - 1], d: despMes, r: recMes }
  })

  const topCategorias = resumo.filter(r=>r.tipo==='despesa').sort((a,b)=>b.total-a.total).slice(0,4)

  function openModal(tipo: 'receita'|'despesa'|'transferencia') {
    setDefaultTipo(tipo); setModalAberto(true)
  }

  return (
    <div className="min-h-full bg-[var(--bg)] animate-fade-in">
      {/* ── HEADER ─────────────────────────────────── */}
      <header className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] capitalize font-medium">
            {format(new Date(), "EEEE, d 'de' MMM", { locale: ptBR })}
          </p>
          <h1 className="text-xl font-bold tracking-tight mt-0.5">Visão geral</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={toggleValoresOcultos} aria-label={valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
            className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            {valoresOcultos ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button type="button" onClick={() => navigate('/busca')} aria-label="Buscar"
            className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <Search size={17} />
          </button>
          <button type="button" onClick={() => navigate('/notificacoes')} aria-label="Notificações"
            className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] relative hover:text-[var(--text)] transition-colors">
            <Bell size={17} />
            {naoLidas > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--danger)] rounded-full border-2 border-[var(--bg)]" />
            )}
          </button>
        </div>
      </header>

      <div className="px-4 pb-28 lg:pb-8 space-y-5 max-w-5xl mx-auto">

        {/* ── DESKTOP GRID (lg): saldo à esquerda + gráfico à direita ── */}
        <div className="lg:grid lg:grid-cols-[1fr_1.5fr] lg:gap-5 space-y-5 lg:space-y-0">

          {/* Saldo total card */}
          <div
            className="rounded-2xl p-5 text-white relative overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, #16142A 0%, var(--primary) 160%)',
              boxShadow: '0 16px 48px var(--primary-glow)',
              border: '1px solid rgba(157,78,221,0.3)',
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] text-white/60 uppercase tracking-widest font-semibold">Resumo do mês</p>
                <p className="text-xs text-white/70 font-medium">{resumoMensal.alerta === 'saudavel' ? 'Saudável' : resumoMensal.alerta === 'atencao' ? 'Em atenção' : 'Crítico'}</p>
              </div>
              <span
                className="rounded-full px-2 py-1 text-[10px] font-bold uppercase"
                style={{
                  background: resumoMensal.alerta === 'saudavel' ? 'rgba(16,185,129,0.2)' : resumoMensal.alerta === 'atencao' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
                  color: resumoMensal.alerta === 'saudavel' ? '#7ef0c1' : resumoMensal.alerta === 'atencao' ? '#f9d98d' : '#ff9ea7',
                }}
              >
                {resumoMensal.alerta}
              </span>
            </div>
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -mr-10 -mt-10 pointer-events-none" />
            <p className="text-[11px] text-white/60 uppercase tracking-widest font-semibold mb-2">Saldo total</p>
            <MoneyDisplay value={saldoTotal} size="xl" oculto={valoresOcultos} />
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] text-white/55 uppercase tracking-wider mb-1">Receitas</p>
                <p className="text-sm font-bold font-mono text-[var(--success)]">{valoresOcultos ? 'R$ ••••••' : `+${formatBRL(resumoMensal.receita)}`}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] text-white/55 uppercase tracking-wider mb-1">Despesas</p>
                <p className="text-sm font-bold font-mono text-[var(--danger)]">{valoresOcultos ? 'R$ ••••••' : `-${formatBRL(resumoMensal.despesa)}`}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] text-white/55 uppercase tracking-wider mb-1">Economia</p>
                <p className="text-sm font-bold font-mono text-[var(--success)]">{valoresOcultos ? 'R$ ••••••' : formatBRL(resumoMensal.economia)}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-[10px] text-white/55 uppercase tracking-wider mb-1">Taxa</p>
                <p className="text-sm font-bold font-mono text-white">{(resumoMensal.taxaEconomia * 100).toFixed(0)}%</p>
              </div>
            </div>

            {resumoMensal.topCategoria && (
              <div className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
                <span className="text-white/55 uppercase tracking-wider">Maior gasto:</span>{' '}
                <span className="font-semibold">{resumoMensal.topCategoria}</span>
                {valoresOcultos ? ' · R$ ••••••' : ` · ${formatBRL(resumoMensal.topCategoriaValor)}`}
              </div>
            )}

            {/* Contas bancárias rápidas */}
            {bancos.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
                {bancos.slice(0, 4).map(b => (
                  <button key={b.id} type="button" onClick={() => navigate('/bancos')}
                    className="flex-shrink-0 bg-white/10 rounded-xl px-3 py-2 text-left hover:bg-white/15 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.cor ?? '#9D4EDD' }} />
                      <p className="text-[9px] text-white/55 uppercase font-semibold tracking-wider truncate max-w-[80px]">{b.instituicao}</p>
                    </div>
                    <p className="text-xs font-bold font-mono">{formatBRLOuOculto(b.saldo_atual ?? b.saldo_inicial, valoresOcultos)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gráfico evolução mensal — carregado sob demanda para não pesar o carregamento inicial */}
          <Suspense fallback={
            <Card padding="lg">
              <SectionTitle title="Evolução dos últimos 6 meses" />
              <div className="h-44 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
              </div>
            </Card>
          }>
            <EvolucaoMensalCard chartData={chartData} />
          </Suspense>
        </div>

        {alertasHome.length > 0 && (
          <div>
            <SectionTitle title="Alertas do mês" action={
              <button type="button" onClick={() => navigate('/notificacoes')} className="text-xs text-[var(--primary)] font-semibold flex items-center gap-0.5">
                Ver tudo <ChevronRight size={13} />
              </button>
            } />
            <div className="space-y-2.5">
              {alertasHome.map(alerta => (
                <div key={alerta.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: alerta.tipo === 'limite' ? 'rgba(239,68,68,0.12)' : alerta.tipo === 'meta' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: alerta.tipo === 'limite' ? 'var(--danger)' : alerta.tipo === 'meta' ? 'var(--success)' : 'var(--warning)' }}>
                      {alerta.tipo === 'limite' ? <TrendingDown size={16} /> : alerta.tipo === 'meta' ? <PiggyBank size={16} /> : <Bell size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">{alerta.titulo}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{alerta.mensagem}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AÇÕES RÁPIDAS ─────────────────────── */}
        <div>
          <SectionTitle title="Ações rápidas" />
          <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            <QuickAction icon={<TrendingDown size={20} />} label="Despesa"     onClick={() => openModal('despesa')}         color="#FF6B7A" />
            <QuickAction icon={<TrendingUp size={20} />}   label="Receita"     onClick={() => openModal('receita')}          color="#00E096" />
            <QuickAction icon={<ArrowRightLeft size={20} />} label="Transferir" onClick={() => openModal('transferencia')}   color="#6C8EF5" />
            <QuickAction icon={<Landmark size={20} />}     label="Bancos"      onClick={() => navigate('/bancos')}          color="#F5C842" />
            <QuickAction icon={<CreditCard size={20} />}   label="Cartões"     onClick={() => navigate('/cartoes')}         color="#9D4EDD" />
            <QuickAction icon={<BarChart2 size={20} />}    label="Relatórios"  onClick={() => navigate('/relatorios')}      color="#22D4A0" />
            <QuickAction icon={<Calendar size={20} />}     label="Calendário"  onClick={() => navigate('/calendario')}     color="#3D5AFE" />
            <QuickAction icon={<PiggyBank size={20} />}    label="Orçamentos"  onClick={() => navigate('/orcamentos')}     color="#00C48C" />
            <QuickAction icon={<Tags size={20} />}         label="Categorias"  onClick={() => navigate('/categorias')}     color="#FF8C00" />
          </div>
        </div>

        {/* ── DESKTOP GRID (lg): transações + categorias ── */}
        <div className="lg:grid lg:grid-cols-[1.5fr_1fr] lg:gap-5 space-y-5 lg:space-y-0">

          {/* Últimas movimentações */}
          <div>
            <SectionTitle title="Últimas movimentações"
              action={
                <button type="button" onClick={() => navigate('/lancamentos')}
                  className="text-xs text-[var(--primary)] font-semibold flex items-center gap-0.5">
                  Ver todas <ChevronRight size={13} />
                </button>
              }
            />
            <Card padding="none">
              {isLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i=><div key={i} className="h-10 rounded-xl bg-[var(--bg-muted)] animate-pulse-soft"/>)}
                </div>
              ) : ultimos.length === 0 ? (
                <p className="p-8 text-center text-sm text-[var(--text-muted)]">Nenhuma movimentação neste mês</p>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {ultimos.map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors">
                      <TxIcon tipo={l.tipo} cor={l.categoria?.cor} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{l.descricao}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {l.categoria?.nome ?? (l.tipo==='transferencia' ? 'Transferência' : '—')}
                          {l.parcelado && ` · ${l.parcela_atual}/${l.total_parcelas}x`}
                          {l.cartao && ` · ${l.cartao.nome}`}
                        </p>
                      </div>
                      <p className={`text-sm font-mono font-bold tabular-nums flex-shrink-0 ${
                        l.tipo==='receita' ? 'text-[var(--success)]' :
                        l.tipo==='transferencia' ? 'text-[var(--accent)]' : 'text-[var(--danger)]'
                      }`}>
                        {valoresOcultos ? '••••••' : <>{l.tipo==='receita' ? '+' : l.tipo==='transferencia' ? '' : '-'}{formatBRL(l.valor)}</>}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Top categorias */}
          {topCategorias.length > 0 && (
            <div>
              <SectionTitle title="Top categorias (mês)" />
              <div className="space-y-2.5">
                {topCategorias.map((c, i) => {
                  const max = topCategorias[0].total
                  const pct = max > 0 ? (c.total / max) * 100 : 0
                  return (
                    <div key={c.categoria_id ?? i} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.categoria_cor ?? '#9D4EDD' }} />
                          <span className="text-xs font-semibold truncate">{c.categoria_nome ?? 'Outros'}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-[var(--danger)] flex-shrink-0">{formatBRLOuOculto(c.total, valoresOcultos)}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.categoria_cor ?? '#9D4EDD' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Cartões resumo */}
        {cartoes.length > 0 && (
          <div>
            <SectionTitle title="Cartões"
              action={
                <button type="button" onClick={() => navigate('/cartoes')}
                  className="text-xs text-[var(--primary)] font-semibold flex items-center gap-0.5">
                  Ver todos <ChevronRight size={13} />
                </button>
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cartoes.slice(0, 3).map(c => (
                <button key={c.id} type="button" onClick={() => navigate(`/cartoes/${c.id}`)}
                  className="text-left bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4 hover:border-[var(--primary)]/40 transition-all active:scale-[0.99]"
                  style={{ boxShadow: 'var(--shadow-sm)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.cor}22`, color: c.cor }}>
                        <CreditCard size={15} />
                      </div>
                      <p className="text-sm font-semibold truncate">{c.nome}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{c.bandeira}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Vence dia {c.dia_vencimento}</p>
                  <p className="text-base font-bold font-mono text-[var(--danger)]">{formatBRLOuOculto(c.limite, valoresOcultos)}</p>
                  <p className="text-[10px] text-[var(--text-subtle)]">limite cadastrado</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <FormLancamentoModal open={modalAberto} onClose={() => setModalAberto(false)} defaultTipo={defaultTipo} />
    </div>
  )
}
