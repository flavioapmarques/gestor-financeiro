import { useState } from 'react'
import { Search } from 'lucide-react'
import { useBuscaLancamentos } from '../hooks/useData'
import { formatBRL } from '../lib/utils'
import { Screen } from '../ui/Screen'
import { Chip, Card } from '../ui/primitives'

export function BuscaPage() {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'despesa' | 'receita' | 'transferencia'>('todos')
  const { data: resultados = [], isFetching } = useBuscaLancamentos(q, filtro)

  const totalResultados = resultados.length

  return (
    <Screen title="Busca" onBack>
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="search"
          placeholder="Buscar por descrição..."
          value={q}
          onChange={e => setQ(e.target.value)}
          className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
          aria-label="Busca global"
        />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <Chip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>
        <Chip active={filtro === 'despesa'} onClick={() => setFiltro('despesa')}>Despesas</Chip>
        <Chip active={filtro === 'receita'} onClick={() => setFiltro('receita')}>Receitas</Chip>
        <Chip active={filtro === 'transferencia'} onClick={() => setFiltro('transferencia')}>Transferências</Chip>
      </div>

      {q.length < 2 && <p className="text-sm text-[var(--text-muted)] text-center py-8">Digite pelo menos 2 caracteres</p>}
      {isFetching && q.length >= 2 && <p className="text-sm text-[var(--text-muted)] text-center py-4">Buscando...</p>}
      {!isFetching && q.length >= 2 && totalResultados === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">Nenhum resultado encontrado para essa busca.</p>
      )}

      {totalResultados > 0 && (
        <div className="mb-3 text-xs text-[var(--text-muted)] px-1">
          {totalResultados} resultado{totalResultados > 1 ? 's' : ''}
        </div>
      )}

      <Card padding="none">
        {resultados.map(l => (
          <div key={l.id} className="flex justify-between items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{l.descricao}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {l.data} · {l.categoria?.nome ?? '—'}
                {l.tipo === 'transferencia' ? ' · Transferência' : ''}
              </p>
            </div>
            <span className={`font-mono text-sm whitespace-nowrap ${l.tipo === 'receita' ? 'text-[var(--success)]' : l.tipo === 'transferencia' ? 'text-[var(--primary)]' : 'text-[var(--danger)]'}`}>
              {l.tipo === 'receita' ? '+' : l.tipo === 'transferencia' ? '' : '-'}{formatBRL(l.valor)}
            </span>
          </div>
        ))}
      </Card>
    </Screen>
  )
}
