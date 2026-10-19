import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCartoes, useAdicionarCartao, useAtualizarCartao, useBancos } from '../hooks/useData'
import type { Bandeira } from '../lib/supabase'
import { Screen } from '../ui/Screen'
import { Button, Input } from '../ui/primitives'
import { CardBrandBadge, LISTA_BANDEIRAS } from '../components/CardBrandBadge'
import { ConfirmarExclusaoCartaoModal } from '../components/cartoes/ConfirmarExclusaoCartaoModal'

const CORES = [
  '#820AD1', // Nubank Roxo
  '#FF7A00', // Inter / Itaú Laranja
  '#CC092F', // Bradesco Vermelho
  '#EC0000', // Santander Vermelho
  '#0038A8', // Banco do Brasil Azul
  '#0066B3', // Caixa Azul
  '#1A1A1A', // C6 Bank Dark
  '#001E62', // BTG / XP Azul Escuro
  '#00E5FF', // Neon Cyan
  '#00A868', // Stone Verde
  '#00C48C', // Esmeralda
  '#3D5AFE', // Azul Royal
  '#6C8EF5', // Índigo
  '#E91E63', // Rosa Magenta
  '#FFB020', // Amarelo Ouro
]

export function AdicionarCartaoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = Boolean(id)
  const { data: cartoes = [] } = useCartoes()
  const { data: bancos = [] } = useBancos()
  const adicionar = useAdicionarCartao()
  const atualizar = useAtualizarCartao()
  const [nome, setNome] = useState('')
  const [banco, setBanco] = useState('')
  const [bandeira, setBandeira] = useState<Bandeira>('visa')
  const [limite, setLimite] = useState('')
  const [fechamento, setFechamento] = useState('3')
  const [vencimento, setVencimento] = useState('10')
  const [cor, setCor] = useState(CORES[0])
  const [bancoPagamentoId, setBancoPagamentoId] = useState('')
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!id) return
    const c = cartoes.find(x => x.id === id)
    if (!c) return
    setNome(c.nome)
    setBanco(c.banco ?? '')
    setBandeira(c.bandeira)
    setLimite(String(c.limite))
    setFechamento(String(c.dia_fechamento))
    setVencimento(String(c.dia_vencimento))
    setCor(c.cor)
    setBancoPagamentoId(c.banco_pagamento_id ?? '')
  }, [id, cartoes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const lim = parseFloat(limite.replace(',', '.'))
    if (!nome.trim() || !lim) {
      setErro('Preencha nome e limite')
      return
    }
    try {
      const dados = {
        nome: nome.trim(),
        banco: banco.trim() || undefined,
        bandeira,
        limite: lim,
        dia_fechamento: Number(fechamento),
        dia_vencimento: Number(vencimento),
        cor,
        banco_pagamento_id: bancoPagamentoId || undefined,
      }
      if (editando && id) {
        await atualizar.mutateAsync({ id, ...dados })
        navigate(`/cartoes/${id}`)
      } else {
        await adicionar.mutateAsync(dados)
        navigate('/cartoes')
      }
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  return (
    <Screen title={editando ? 'Editar cartão' : 'Novo cartão'} onBack>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome do cartão" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Nubank Ultravioleta, Itaú Click" />
        <Input label="Banco emissor" value={banco} onChange={e => setBanco(e.target.value)} placeholder="Ex: Nubank, Itaú, Santander" />

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">Bandeira do cartão</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LISTA_BANDEIRAS.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBandeira(b.id)}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-left transition-all ${
                  bandeira === b.id
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] ring-1 ring-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--bg-muted)] hover:border-[var(--primary)]/40'
                }`}
              >
                <span className="text-xs font-medium text-[var(--text)] truncate">{b.label}</span>
                <CardBrandBadge bandeira={b.id} size="sm" />
              </button>
            ))}
          </div>
        </div>

        <Input label="Limite (R$)" inputMode="decimal" value={limite} onChange={e => setLimite(e.target.value)} required placeholder="5000,00" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Dia fechamento" type="number" min={1} max={31} value={fechamento} onChange={e => setFechamento(e.target.value)} required />
          <Input label="Dia vencimento" type="number" min={1} max={31} value={vencimento} onChange={e => setVencimento(e.target.value)} required />
        </div>

        {bancos.length > 0 && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block font-semibold">Banco que paga a fatura (opcional)</label>
            <select
              value={bancoPagamentoId}
              onChange={e => setBancoPagamentoId(e.target.value)}
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">Nenhum definido</option>
              {bancos.map(b => <option key={b.id} value={b.id}>{b.instituicao} — {b.nome}</option>)}
            </select>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">Usado para sugerir a conta ao pagar a fatura e mostrar o gasto do cartão nos relatórios daquela conta.</p>
          </div>
        )}

        <div>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-semibold">Cor do cartão</span>
          <div className="flex flex-wrap gap-2.5">
            {CORES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`w-9 h-9 rounded-full border-2 transition-transform ${cor === c ? 'border-[var(--text)] scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ background: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        {erro && <p className="text-xs text-[var(--danger)]">{erro}</p>}

        <div className="space-y-2 pt-2">
          <Button type="submit" className="w-full" size="lg" loading={adicionar.isPending || atualizar.isPending}>
            {editando ? 'Salvar alterações' : 'Salvar cartão'}
          </Button>

          {editando && (
            <Button
              type="button"
              variant="outline"
              className="w-full !text-[var(--danger)] !border-[var(--danger)]/30 hover:!bg-[var(--danger)]/10"
              onClick={() => setModalExcluirAberto(true)}
            >
              Excluir este cartão
            </Button>
          )}
        </div>
      </form>

      {editando && id && (
        <ConfirmarExclusaoCartaoModal
          open={modalExcluirAberto}
          cartao={{ id, nome: nome || 'Cartão' }}
          onClose={() => setModalExcluirAberto(false)}
          onSuccess={() => navigate('/cartoes')}
        />
      )}
    </Screen>
  )
}


