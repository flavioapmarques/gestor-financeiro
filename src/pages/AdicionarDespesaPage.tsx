import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAdicionarLancamento, useCategorias, useCartoes, useBancos } from '../hooks/useData'
import { Screen } from '../ui/Screen'
import { Button, Input, Card } from '../ui/primitives'

export function AdicionarDespesaPage() {
  const navigate = useNavigate()
  const adicionar = useAdicionarLancamento()
  const { data: categorias = [] } = useCategorias()
  const { data: cartoes = [] } = useCartoes()
  const { data: bancos = [] } = useBancos()
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [categoriaId, setCategoriaId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [bancoId, setBancoId] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [parcelas, setParcelas] = useState(3)
  const [obs, setObs] = useState('')
  const [local, setLocal] = useState('')


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valor.replace(',', '.'))
    if (!descricao || !v) return
    await adicionar.mutateAsync({
      tipo: 'despesa',
      descricao,
      valor: v,
      data,
      categoria_id: categoriaId || undefined,
      cartao_id: cartaoId || undefined,
      banco_id: bancoId || undefined,
      parcelado,
      total_parcelas: parcelado ? parcelas : undefined,
      parcela_atual: parcelado ? 1 : undefined,
      recorrente: false,
      efetivado: true,
        observacao: obs || undefined,
        local_compra: local || undefined,
      })
    navigate(-1)
  }

  return (
    <Screen title="Nova despesa" onBack>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Valor (R$)" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} required placeholder="0,00" />
        <Input label="Descrição" value={descricao} onChange={e => setDescricao(e.target.value)} required />
        <Input label="Data" type="date" value={data} onChange={e => setData(e.target.value)} required />
        <div>
          <label className="text-[10px] uppercase text-[var(--text-muted)] mb-1 block">Categoria</label>
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm">
            <option value="">Selecione</option>
            {categorias.filter(c => c.tipo === 'despesa' || c.tipo === 'ambos').map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[var(--text-muted)] mb-1 block">Banco (débito/PIX)</label>
          <select value={bancoId} onChange={e => { setBancoId(e.target.value); if (e.target.value) setCartaoId('') }} className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm">
            <option value="">Nenhum</option>
            {bancos.map(b => (
              <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-[var(--text-muted)] mb-1 block">Cartão</label>
          <select value={cartaoId} onChange={e => { setCartaoId(e.target.value); if (e.target.value) setBancoId('') }} className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm">
            <option value="">Nenhum</option>
            {cartoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <Card>
          <label className="flex justify-between items-center cursor-pointer">
            <span className="text-sm">Parcelado</span>
            <input type="checkbox" checked={parcelado} onChange={e => setParcelado(e.target.checked)} className="accent-[var(--primary)]" />
          </label>
          {parcelado && (
            <div className="mt-3 flex gap-2">
              <Input type="number" min={2} value={parcelas} onChange={e => setParcelas(Number(e.target.value))} label="Parcelas" />
              <Button type="button" variant="ghost" className="self-end" onClick={() => navigate('/parcelamento')}>Simular</Button>
            </div>
          )}
        </Card>
        <Input label="Observação" value={obs} onChange={e => setObs(e.target.value)} />
        <Input label="Local da compra" value={local} onChange={e => setLocal(e.target.value)} placeholder="Opcional" />
        <button type="button" className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-[var(--border)] rounded-xl text-sm text-[var(--text-muted)]">
          <Upload size={18} /> Anexar comprovante
        </button>
        <Button type="submit" className="w-full" size="lg" loading={adicionar.isPending}>Salvar despesa</Button>
      </form>
    </Screen>
  )
}
