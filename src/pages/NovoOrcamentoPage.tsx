import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCategorias, useOrcamentos, useAdicionarOrcamento } from '../hooks/useData'
import { useStore } from '../lib/store'
import { agruparCategorias } from '../lib/categorias'
import { Screen } from '../ui/Screen'
import { Button, Input } from '../ui/primitives'

export function NovoOrcamentoPage() {
  const navigate = useNavigate()
  const { filtroMes, filtroAno } = useStore()
  const { data: categorias = [] } = useCategorias()
  const { data: orcamentosAtuais = [] } = useOrcamentos(filtroMes, filtroAno)
  const adicionar = useAdicionarOrcamento()

  const jaOrcadas = new Set(orcamentosAtuais.map(o => o.categoria_id))
  const despesas = categorias.filter(c => (c.tipo === 'despesa' || c.tipo === 'ambos') && !jaOrcadas.has(c.id))
  const arvore = agruparCategorias(despesas)

  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState('')
  const [recorrente, setRecorrente] = useState(true)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const lim = parseFloat(valor.replace(',', '.'))
    if (!categoriaId) { setErro('Escolha uma categoria'); return }
    if (!lim || lim <= 0) { setErro('Informe um valor válido'); return }
    try {
      await adicionar.mutateAsync({
        categoria_id: categoriaId,
        valor_limite: lim,
        mes: recorrente ? undefined : filtroMes,
        ano: recorrente ? undefined : filtroAno,
      })
      navigate('/orcamentos')
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar orçamento')
    }
  }

  return (
    <Screen title="Novo orçamento" onBack>
      {despesas.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Todas as suas categorias de despesa já têm um orçamento definido para este mês.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">Categoria</label>
            <select
              value={categoriaId}
              onChange={e => setCategoriaId(e.target.value)}
              required
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">Selecione...</option>
              {arvore.map(pai => (
                <optgroup key={pai.id} label={pai.nome}>
                  <option value={pai.id}>{pai.nome} (principal)</option>
                  {pai.subcategorias?.map(sub => (
                    <option key={sub.id} value={sub.id}>↳ {sub.nome}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <Input label="Limite mensal (R$)" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} required placeholder="Ex: 800,00" />

          <label className="flex items-center gap-3 bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
            <span className="text-sm">
              <span className="block font-medium">Repetir todo mês</span>
              <span className="block text-xs text-[var(--text-muted)]">Se desmarcado, vale só para {String(filtroMes).padStart(2, '0')}/{filtroAno}</span>
            </span>
          </label>

          {erro && <p className="text-xs text-[var(--danger)]">{erro}</p>}
          <Button type="submit" className="w-full" size="lg" loading={adicionar.isPending}>Criar orçamento</Button>
        </form>
      )}
    </Screen>
  )
}
