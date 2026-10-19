import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, PiggyBank, X } from 'lucide-react'
import { useMetas, useAtualizarMeta } from '../hooks/useData'
import { formatBRL } from '../lib/utils'
import { Screen, FAB } from '../ui/Screen'
import { Card, Button, Badge, Input } from '../ui/primitives'
import { ProgressBar } from '../ui/finance'
import { EmptyState } from '../ui/feedback'
import type { Meta } from '../lib/supabase'

function AportarModal({ meta, onClose }: { meta: Meta; onClose: () => void }) {
  const atualizar = useAtualizarMeta()
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState('')

  async function handleAportar(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) { setErro('Informe um valor válido'); return }
    try {
      const novoValor = meta.valor_atual + v
      await atualizar.mutateAsync({
        id: meta.id,
        valor_atual: novoValor,
        concluida: novoValor >= meta.valor_alvo,
      })
      onClose()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar aporte')
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 md:p-4 md:items-center">
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-3xl md:rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">Aportar em "{meta.nome}"</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)]">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleAportar} className="p-4 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            Atual: <span className="font-mono">{formatBRL(meta.valor_atual)}</span> de {formatBRL(meta.valor_alvo)}
          </p>
          <Input label="Valor do aporte (R$)" inputMode="decimal" autoFocus value={valor} onChange={e => setValor(e.target.value)} />
          {erro && <p className="text-xs text-[var(--danger)]">{erro}</p>}
          <Button type="submit" className="w-full" size="lg" loading={atualizar.isPending}>
            <PiggyBank size={16} /> Confirmar aporte
          </Button>
        </form>
      </div>
    </div>
  )
}

export function MetasPage() {
  const navigate = useNavigate()
  const { data: metasApi = [] } = useMetas()
  const [metaAportando, setMetaAportando] = useState<Meta | null>(null)
  const lista = metasApi.map(m => ({
    id: m.id,
    nome: m.nome,
    alvo: m.valor_alvo,
    atual: m.valor_atual,
    prazo: m.prazo ?? '',
    cor: m.cor,
    concluida: m.concluida,
  }))

  return (
    <Screen title="Metas financeiras" subtitle="Seus objetivos">
      {lista.length === 0 ? (
        <EmptyState variant="metas" title="Sem metas" description="Crie sua primeira meta de economia" action={<Button onClick={() => navigate('/metas/nova')}>Criar meta</Button>} />
      ) : (
        <div className="space-y-4">
          {lista.map(m => {
            const pct = m.alvo > 0 ? (m.atual / m.alvo) * 100 : 0
            const falta = Math.max(0, m.alvo - m.atual)
            const meses = m.prazo ? 6 : 1
            const metaOriginal = metasApi.find(x => x.id === m.id)!
            return (
              <Card key={m.id}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold">{m.nome}</h3>
                    <p className="text-xs text-[var(--text-muted)]">Prazo: {m.prazo || '—'}</p>
                  </div>
                  {'concluida' in m && m.concluida && <Badge variant="success"><Trophy size={10} className="inline mr-1" />Concluída</Badge>}
                </div>
                <div className="flex justify-between text-sm font-mono mb-2">
                  <span className="text-[var(--primary)]">{formatBRL(m.atual)}</span>
                  <span className="text-[var(--text-muted)]">de {formatBRL(m.alvo)}</span>
                </div>
                <ProgressBar value={m.atual} max={m.alvo} color={m.cor} />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {pct.toFixed(0)}% · Economize {formatBRL(falta / meses)}/mês
                  </p>
                  {!m.concluida && (
                    <button type="button" onClick={() => setMetaAportando(metaOriginal)}
                      className="text-[11px] font-semibold text-[var(--primary)] flex items-center gap-1">
                      <PiggyBank size={12} /> Aportar
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <FAB onClick={() => navigate('/metas/nova')} label="Nova meta" />
      {metaAportando && <AportarModal meta={metaAportando} onClose={() => setMetaAportando(null)} />}
    </Screen>
  )
}
