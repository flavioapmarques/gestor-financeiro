import { useMemo, useState } from 'react'
import { Briefcase, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Screen, FAB } from '../ui/Screen'
import { Card, Chip, Button } from '../ui/primitives'
import { formatBRL, mesAnterior, nomeMes, proximoMes } from '../lib/utils'
import { EmptyState } from '../ui/feedback'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'
import { useLancamentos } from '../hooks/useData'
import { useStore } from '../lib/store'

export function ReceitasPage() {
  const { filtroMes, filtroAno, setFiltroMes, setFiltroAno } = useStore()
  const { data: lancamentos = [], isLoading, isError } = useLancamentos(filtroMes, filtroAno)
  const [tab, setTab] = useState<'todas' | 'recorrentes'>('todas')
  const [modal, setModal] = useState(false)

  const receitas = useMemo(() => lancamentos.filter(l => l.tipo === 'receita'), [lancamentos])
  const lista = useMemo(() => tab === 'recorrentes' ? receitas.filter(h => h.recorrente) : receitas, [tab, receitas])
  const totalMes = useMemo(() => receitas.reduce((s, l) => s + l.valor, 0), [receitas])

  function mudarMes(delta: -1 | 1) {
    const fn = delta === -1 ? mesAnterior : proximoMes
    const { mes, ano } = fn(filtroMes, filtroAno)
    setFiltroMes(mes)
    setFiltroAno(ano)
  }

  return (
    <Screen title="Receitas" subtitle="Entradas e extras">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex gap-2">
          <Chip active={tab === 'todas'} onClick={() => setTab('todas')}>Todas</Chip>
          <Chip active={tab === 'recorrentes'} onClick={() => setTab('recorrentes')}>Recorrentes</Chip>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-muted)] p-1">
          <button type="button" onClick={() => mudarMes(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]" aria-label="Mês anterior"><ChevronLeft size={16} /></button>
          <span className="min-w-[110px] text-center text-[11px] font-semibold capitalize">{nomeMes(filtroMes, filtroAno)}</span>
          <button type="button" onClick={() => mudarMes(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)]" aria-label="Próximo mês"><ChevronRight size={16} /></button>
        </div>
      </div>

      <Card className="mb-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--success)]/15 flex items-center justify-center">
          <Briefcase size={22} className="text-[var(--success)]" />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)]">Total do mês</p>
          <p className="text-xl font-bold font-mono text-[var(--success)]">{formatBRL(totalMes)}</p>
        </div>
      </Card>

      {isLoading && <p className="text-sm text-[var(--text-muted)]">Carregando receitas…</p>}
      {isError && <p className="text-sm text-[var(--danger)]">Erro ao carregar receitas.</p>}

      {!isLoading && !isError && lista.length === 0 ? (
        <EmptyState variant="transacoes" title="Sem receitas" description="Cadastre salário ou extras" action={<Button onClick={() => setModal(true)}>Adicionar</Button>} />
      ) : (
        <Card padding="none">
          {lista.map(h => (
            <div key={h.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{h.descricao}</p>
                <p className="text-[11px] text-[var(--text-muted)] flex flex-wrap items-center gap-1">
                  <span>{h.data}</span>
                  {h.categoria?.nome && <span>• {h.categoria.nome}</span>}
                  {h.banco && <span>• {h.banco.instituicao}</span>}
                  {h.recorrente && <><RefreshCw size={10} /> Recorrente</>}
                </p>
                {h.observacao && (
                  <p className="mt-1 text-[11px] text-[var(--text-muted)] truncate">Obs: {h.observacao}</p>
                )}
              </div>
              <p className="font-mono text-sm text-[var(--success)]">+{formatBRL(h.valor)}</p>
            </div>
          ))}
        </Card>
      )}

      <FormLancamentoModal open={modal} onClose={() => setModal(false)} defaultTipo="receita" />

      <FAB onClick={() => setModal(true)} label="Nova receita" />
    </Screen>
  )
}
