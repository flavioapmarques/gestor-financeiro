import { useNavigate } from 'react-router-dom'
import { Landmark, Pencil, Trash2, TrendingUp, TrendingDown, Upload, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useBancos, useDeletarBanco, useSaldosBancosFimDoMes } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL, mesAnterior, proximoMes, nomeMes } from '../lib/utils'
import { FAB, PageHeader } from '../ui/Screen'
import { Button } from '../ui/primitives'
import { BankIcon } from '../components/BankIcon'


export function BancosPage() {
  const navigate = useNavigate()
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const { data: bancos = [], isLoading, isError } = useBancos()
  const { data: saldosFimMesMap } = useSaldosBancosFimDoMes(filtroMes, filtroAno)
  const deletar = useDeletarBanco()

  const saldoTotalAtual = bancos.reduce((a, b) => a + (b.saldo_atual ?? b.saldo_inicial), 0)
  const saldoTotalFimMes = bancos.reduce((a, b) => a + (saldosFimMesMap?.get(b.id) ?? b.saldo_atual ?? b.saldo_inicial), 0)

  function mudarMes(delta: -1 | 1) {
    const fn = delta === -1 ? mesAnterior : proximoMes
    const next = fn(filtroMes, filtroAno)
    setFiltroMes(next.mes)
    setFiltroAno(next.ano)
  }

  const hoje = new Date()
  const noMesAtual = filtroMes === hoje.getMonth() + 1 && filtroAno === hoje.getFullYear()

  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"? Lançamentos vinculados podem ser afetados.`)) return
    try { await deletar.mutateAsync(id) }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Erro ao excluir') }
  }

  return (
    <div className="min-h-full bg-[var(--bg)] animate-fade-in pb-28 lg:pb-8">
      <div className="px-4 max-w-4xl mx-auto">
        <PageHeader title="Bancos" subtitle="Suas contas e saldos" rightAction={
          <button type="button" onClick={() => navigate('/importar-ofx')} aria-label="Importar extrato OFX"
            className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            <Upload size={16} />
          </button>
        } />

        {/* Seletor de Mês/Ano */}
        <div className="flex items-center justify-between mb-4 bg-[var(--bg-muted)] rounded-xl px-3 py-2 border border-[var(--border)]">
          <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-[var(--primary)]" />
            <span className="text-sm font-semibold capitalize">{nomeMes(filtroMes, filtroAno)}</span>
            {!noMesAtual && (
              <button type="button" onClick={() => { setFiltroMes(hoje.getMonth() + 1); setFiltroAno(hoje.getFullYear()) }}
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                Hoje
              </button>
            )}
          </div>
          <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i=><div key={i} className="h-28 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] animate-pulse-soft"/>)}
          </div>
        )}

        {isError && (
          <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-2xl p-4 text-sm text-[var(--danger)]">
            Erro ao carregar os bancos.
          </div>
        )}

        {!isLoading && !isError && bancos.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary-soft)] flex items-center justify-center mx-auto mb-4">
              <Landmark size={28} className="text-[var(--primary)]" />
            </div>
            <p className="font-semibold mb-1">Nenhuma conta cadastrada</p>
            <p className="text-sm text-[var(--text-muted)] mb-5">Cadastre seu banco com saldo inicial e a data de referência</p>
            <Button onClick={() => navigate('/bancos/novo')}>Cadastrar banco</Button>
          </div>
        )}

        {bancos.length > 0 && (
          <>
            {/* Card saldo total */}
            <div className="rounded-2xl p-5 mb-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, #16142A 0%, var(--primary) 160%)',
                border: '1px solid rgba(157,78,221,0.3)',
                boxShadow: '0 16px 48px var(--primary-glow)',
              }}>
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-8 -mt-8 pointer-events-none" />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-white/60 uppercase tracking-widest font-semibold mb-1">Saldo Total Atual</p>
                  <p className={`text-3xl font-bold font-mono tracking-tight ${saldoTotalAtual < 0 ? 'text-[var(--danger)]' : 'text-white'}`}>{formatBRL(saldoTotalAtual)}</p>
                </div>
                <div className="sm:border-l sm:border-white/10 sm:pl-4">
                  <p className="text-[11px] text-white/60 uppercase tracking-widest font-semibold mb-1">
                    Saldo Final em {nomeMes(filtroMes, filtroAno)}
                  </p>
                  <p className={`text-3xl font-bold font-mono tracking-tight ${saldoTotalFimMes < 0 ? 'text-[var(--danger)]' : 'text-white/90'}`}>{formatBRL(saldoTotalFimMes)}</p>
                </div>
              </div>

              <p className="text-[11px] text-white/50 mt-3">{bancos.length} conta{bancos.length>1?'s':''} ativa{bancos.length>1?'s':''}</p>
            </div>

            {/* Grid de contas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {bancos.map(b => {
                const saldoAtual = b.saldo_atual ?? b.saldo_inicial
                const saldoFimMes = saldosFimMesMap?.get(b.id) ?? saldoAtual
                const diff = saldoAtual - b.saldo_inicial
                const positivo = diff >= 0

                return (
                  <div key={b.id} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4 group hover:border-[var(--primary)]/30 transition-all"
                    style={{ boxShadow: 'var(--shadow-card)' }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: `${b.cor ?? '#9D4EDD'}22`, color: b.cor ?? '#9D4EDD' }}>
                          <BankIcon icone={b.icone} size={20} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{b.instituicao}</p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">{b.nome}</p>
                        </div>
                      </div>
                      <div className="flex gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => navigate(`/bancos/${b.id}/editar`)}
                          className="p-2 rounded-lg hover:bg-[var(--primary-soft)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors" aria-label="Editar">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => handleExcluir(b.id, b.instituicao)}
                          className="p-2 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors" aria-label="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-[var(--border)]">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Saldo atual</span>
                        <span className={`text-base font-bold font-mono ${saldoAtual < 0 ? 'text-[var(--danger)]' : ''}`}>
                          {formatBRL(saldoAtual)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-[var(--bg-muted)] p-2 rounded-xl border border-[var(--border)]">
                        <span className="text-xs font-semibold text-[var(--primary)]">
                          Saldo final em {nomeMes(filtroMes, filtroAno)}
                        </span>
                        <span className={`text-base font-bold font-mono ${saldoFimMes < 0 ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                          {formatBRL(saldoFimMes)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <div className="flex items-center gap-1">
                          {positivo
                            ? <TrendingUp size={12} className="text-[var(--success)]" />
                            : <TrendingDown size={12} className="text-[var(--danger)]" />}
                          <span className={`font-semibold ${positivo ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                            {positivo ? '+' : ''}{formatBRL(diff)} desde o inicial
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-subtle)] capitalize">{b.tipo}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <FAB onClick={() => navigate('/bancos/novo')} label="Cadastrar banco" />
    </div>
  )
}
