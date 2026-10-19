import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Trash2, Pencil } from 'lucide-react'
import {
  useCategorias,
  useAdicionarCategoria,
  useAtualizarCategoria,
  useDeletarCategoria,
} from '../hooks/useData'
import { agruparCategorias } from '../lib/categorias'
import type { TipoCategoria } from '../lib/supabase'
import { Screen } from '../ui/Screen'
import { Button, Card, Input, Chip } from '../ui/primitives'
import { EmptyState } from '../ui/feedback'

const CORES = ['#820AD1', '#FF6B6B', '#00C48C', '#3D5AFE', '#FFB020', '#6B7280', '#9D4EDD']

type ModoForm = 'categoria' | 'subcategoria' | null

export function CategoriasPage() {
  const { data: categorias = [], isLoading } = useCategorias()
  const adicionar = useAdicionarCategoria()
  const atualizar = useAtualizarCategoria()
  const deletar = useDeletarCategoria()

  const arvore = agruparCategorias(categorias)
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})
  const [modo, setModo] = useState<ModoForm>(null)
  const [paiId, setPaiId] = useState<string>('')
  const [editId, setEditId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoCategoria>('despesa')
  const [cor, setCor] = useState(CORES[0])
  const [icone, setIcone] = useState('tag')
  const [erro, setErro] = useState('')

  function abrirNovaCategoria() {
    setModo('categoria')
    setPaiId('')
    setEditId(null)
    setNome('')
    setTipo('despesa')
    setCor(CORES[0])
    setIcone('tag')
    setErro('')
  }

  function abrirNovaSub(pai: string) {
    setModo('subcategoria')
    setPaiId(pai)
    setEditId(null)
    setNome('')
    setTipo('despesa')
    setCor(CORES[1])
    setIcone('tag')
    setErro('')
    setExpandido(e => ({ ...e, [pai]: true }))
  }

  function abrirEditar(id: string, c: { nome: string; tipo: TipoCategoria; cor: string; icone: string; parent_id?: string }) {
    setModo(c.parent_id ? 'subcategoria' : 'categoria')
    setPaiId(c.parent_id ?? '')
    setEditId(id)
    setNome(c.nome)
    setTipo(c.tipo)
    setCor(c.cor)
    setIcone(c.icone)
    setErro('')
  }

  function fecharForm() {
    setModo(null)
    setEditId(null)
    setErro('')
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) {
      setErro('Informe o nome')
      return
    }
    try {
      if (editId) {
        await atualizar.mutateAsync({ id: editId, nome: nome.trim(), tipo, cor, icone })
      } else {
        await adicionar.mutateAsync({
          nome: nome.trim(),
          tipo: modo === 'subcategoria' ? 'despesa' : tipo,
          cor,
          icone,
          parent_id: modo === 'subcategoria' ? paiId : undefined,
        })
      }
      fecharForm()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  async function handleExcluir(id: string, nomeCat: string) {
    if (!confirm(`Excluir "${nomeCat}"? Subcategorias também serão removidas.`)) return
    try {
      await deletar.mutateAsync(id)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <Screen title="Categorias" subtitle="Categorias e subcategorias" onBack>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Chip active={true}>Todas</Chip>
        <Button size="sm" onClick={abrirNovaCategoria}><Plus size={16} /> Categoria</Button>
      </div>

      {isLoading && <p className="text-sm text-[var(--text-muted)] text-center py-8">Carregando...</p>}

      {!isLoading && arvore.length === 0 && (
        <EmptyState
          variant="transacoes"
          title="Sem categorias"
          description="Crie categorias para organizar receitas e despesas"
          action={<Button onClick={abrirNovaCategoria}>Criar categoria</Button>}
        />
      )}

      <div className="space-y-2">
        {arvore.map(pai => (
          <Card key={pai.id} padding="none">
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                type="button"
                onClick={() => setExpandido(e => ({ ...e, [pai.id]: !e[pai.id] }))}
                className="text-[var(--text-muted)]"
                aria-expanded={!!expandido[pai.id]}
              >
                {(pai.subcategorias?.length ?? 0) > 0 ? (
                  expandido[pai.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                ) : (
                  <span className="w-[18px]" />
                )}
              </button>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${pai.cor}22`, color: pai.cor }}>
                {pai.icone?.length <= 2 ? pai.icone : '🏷️'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{pai.nome}</p>
                <p className="text-[10px] text-[var(--text-muted)] capitalize">{pai.tipo}</p>
              </div>
              <button type="button" onClick={() => abrirEditar(pai.id, pai)} className="p-2 text-[var(--text-muted)]" aria-label="Editar"><Pencil size={14} /></button>
              <button type="button" onClick={() => abrirNovaSub(pai.id)} className="p-2 text-[var(--primary)]" aria-label="Nova subcategoria"><Plus size={14} /></button>
              <button type="button" onClick={() => handleExcluir(pai.id, pai.nome)} className="p-2 text-[var(--danger)]" aria-label="Excluir"><Trash2 size={14} /></button>
            </div>

            {expandido[pai.id] && (pai.subcategorias?.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border)] bg-[var(--bg-muted)]/50 pl-12 pr-2 py-1">
                {pai.subcategorias!.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 py-2 border-b border-[var(--border)] last:border-0">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-xs" style={{ background: `${sub.cor}22`, color: sub.cor }}>
                      {sub.icone?.length <= 2 ? sub.icone : '·'}
                    </div>
                    <span className="flex-1 text-sm">{sub.nome}</span>
                    <button type="button" onClick={() => abrirEditar(sub.id, sub)} className="p-1.5 text-[var(--text-muted)]"><Pencil size={12} /></button>
                    <button type="button" onClick={() => handleExcluir(sub.id, sub.nome)} className="p-1.5 text-[var(--danger)]"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {modo && (
        <div className="fixed inset-0 z-[60] flex justify-end flex-col bg-black/50" onClick={fecharForm}>
          <div className="bg-[var(--bg-elevated)] rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">
              {editId ? 'Editar' : 'Nova'} {modo === 'subcategoria' ? 'subcategoria' : 'categoria'}
            </h3>
            <form onSubmit={handleSalvar} className="space-y-3">
              <Input label="Nome" value={nome} onChange={e => setNome(e.target.value)} required />
              {modo === 'categoria' && (
                <div>
                  <span className="text-[10px] uppercase text-[var(--text-muted)] mb-1 block">Tipo</span>
                  <div className="flex gap-2">
                    {(['despesa', 'receita', 'ambos'] as TipoCategoria[]).map(t => (
                      <Chip key={t} active={tipo === t} onClick={() => setTipo(t)}>{t}</Chip>
                    ))}
                  </div>
                </div>
              )}
              <Input label="Ícone (emoji ou nome)" value={icone} onChange={e => setIcone(e.target.value)} placeholder="🍽️ ou shopping-cart" />
              <div>
                <span className="text-[10px] uppercase text-[var(--text-muted)] mb-2 block">Cor</span>
                <div className="flex flex-wrap gap-2">
                  {CORES.map(c => (
                    <button key={c} type="button" onClick={() => setCor(c)} className={`w-8 h-8 rounded-full border-2 ${cor === c ? 'border-[var(--text)] scale-110' : 'border-transparent'}`} style={{ background: c }} />
                  ))}
                </div>
              </div>
              {erro && <p className="text-xs text-[var(--danger)]">{erro}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="ghost" className="flex-1" onClick={fecharForm}>Cancelar</Button>
                <Button type="submit" className="flex-1" loading={adicionar.isPending || atualizar.isPending}>Salvar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Screen>
  )
}
