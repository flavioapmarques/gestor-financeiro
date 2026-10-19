import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Screen } from '../ui/Screen'
import { Card, Badge } from '../ui/primitives'
import { formatBRL, nomeMes } from '../lib/utils'
import { useLancamentos } from '../hooks/useData'
import { useStore } from '../lib/store'

export function CalendarioPage() {
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const { data: lancamentos = [] } = useLancamentos(filtroMes, filtroAno)

  const totalDias = useMemo(() => new Date(filtroAno, filtroMes, 0).getDate(), [filtroAno, filtroMes])
  const dias = Array.from({ length: totalDias }, (_, i) => i + 1)
  // Dia da semana do dia 1 (0 = domingo) — usado para alinhar o grid corretamente
  const offsetSemana = useMemo(() => new Date(filtroAno, filtroMes - 1, 1).getDay(), [filtroAno, filtroMes])

  const eventos = useMemo(() =>
    lancamentos
      .map(item => ({
        dia: Number(item.data.slice(-2)),
        tipo: item.tipo,
        titulo: item.descricao,
        valor: item.valor,
        categoria: item.categoria?.nome ?? 'Sem categoria',
        noCartao: Boolean(item.cartao_id),
      }))
      .sort((a, b) => a.dia - b.dia),
  [lancamentos])

  function mudarMes(delta: -1 | 1) {
    const hoje = new Date(filtroAno, filtroMes - 1, 1)
    hoje.setMonth(hoje.getMonth() + delta)
    setFiltroMes(hoje.getMonth() + 1)
    setFiltroAno(hoje.getFullYear())
  }

  return (
    <Screen title="Calendário financeiro" subtitle={nomeMes(filtroMes, filtroAno)} onBack>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => mudarMes(-1)} className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center" aria-label="Mês anterior"><ChevronLeft size={18} /></button>
        <span className="font-semibold capitalize">{nomeMes(filtroMes, filtroAno)}</span>
        <button type="button" onClick={() => mudarMes(1)} className="w-9 h-9 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center" aria-label="Próximo mês"><ChevronRight size={18} /></button>
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--text-muted)] mb-2">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offsetSemana }, (_, i) => <div key={`vazio-${i}`} />)}
          {dias.map(d => {
            const ev = eventos.find(e => e.dia === d)
            return (
              <div
                key={d}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${
                  ev ? 'bg-[var(--primary-soft)] text-[var(--primary)] font-semibold' : 'text-[var(--text-muted)]'
                }`}
              >
                {d}
                {ev && <span className={`w-1 h-1 rounded-full mt-0.5 ${ev.noCartao ? 'bg-[var(--accent)]' : 'bg-[var(--primary)]'}`} />}
              </div>
            )
          })}
        </div>
      </Card>
      <div className="flex items-center gap-4 mb-4 px-1">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />Conta/débito
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />Cartão de crédito
        </span>
      </div>

      <h3 className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-2">Eventos do mês</h3>
      {eventos.length === 0 ? (
        <Card padding="sm" className="text-sm text-[var(--text-muted)]">Nenhum lançamento encontrado para este mês.</Card>
      ) : (
        <div className="space-y-2">
          {eventos.map((e, i) => (
            <Card key={`${e.dia}-${e.titulo}-${i}`} padding="sm" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center text-sm font-bold">{e.dia}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.titulo}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{e.categoria}</p>
                <div className="mt-1"><Badge variant={e.tipo === 'receita' ? 'success' : 'danger'}>{e.tipo}</Badge></div>
              </div>
              <span className="font-mono text-sm">{e.tipo === 'receita' ? '+' : '-'}{formatBRL(e.valor)}</span>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}
