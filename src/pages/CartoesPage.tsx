import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, CheckCircle2, ChevronRight, Upload, Trash2 } from 'lucide-react'
import { useCartoes, useFaturaCartao, usePagamentoFatura, useLimiteUtilizadoCartao } from '../hooks/useData'
import { useStore } from '../lib/store'
import { formatBRL } from '../lib/utils'
import { FAB, PageHeader } from '../ui/Screen'
import { CreditCardVisual } from '../ui/finance'
import { Button, Badge } from '../ui/primitives'
import { FormLancamentoModal } from '../components/lancamentos/FormLancamentoModal'
import { ConfirmarExclusaoCartaoModal } from '../components/cartoes/ConfirmarExclusaoCartaoModal'

function CartaoCard({ cartao, onNovaDespesa, onExcluir }: {
  cartao: { id: string; nome: string; banco?: string; bandeira: string; limite: number; cor: string; dia_fechamento: number; dia_vencimento: number }
  onNovaDespesa: (cartaoId: string) => void
  onExcluir: (cartao: { id: string; nome: string }) => void
}) {

  const navigate = useNavigate()
  const { filtroMes, filtroAno } = useStore()
  const { data: fatura } = useFaturaCartao(cartao.id, filtroMes, filtroAno)
  const { data: pagamento } = usePagamentoFatura(cartao.id, filtroMes, filtroAno)
  const { data: limiteUtilizado = 0 } = useLimiteUtilizadoCartao(cartao)
  const faturaAtual = Number(fatura?.total_fatura ?? 0)
  const paga = !!pagamento
  const pct = cartao.limite > 0 ? Math.min(100, (limiteUtilizado / cartao.limite) * 100) : 0

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--primary)]/30 transition-all group"
      style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Cabeçalho visual do cartão */}
      <button type="button" onClick={() => navigate(`/cartoes/${cartao.id}`)} className="block w-full">
        <CreditCardVisual
          nome={cartao.nome}
          banco={cartao.banco ?? cartao.nome}
          bandeira={cartao.bandeira}
          limite={cartao.limite}
          usado={limiteUtilizado}
          cor={cartao.cor}
        />
      </button>

      {/* Info abaixo do cartão */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-0.5">Fatura atual</p>
            <p className="text-xl font-bold font-mono text-[var(--danger)]">{formatBRL(faturaAtual)}</p>
          </div>
          <div className="text-right">
            {paga
              ? <Badge variant="success"><CheckCircle2 size={10} />Paga</Badge>
              : faturaAtual > 0
              ? <Badge variant="warning">Em aberto</Badge>
              : <Badge>Sem lançamentos</Badge>
            }
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5">Vence dia {cartao.dia_vencimento}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={() => navigate(`/cartoes/${cartao.id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            Ver fatura <ChevronRight size={13} />
          </button>
          <button type="button" onClick={() => onNovaDespesa(cartao.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all active:scale-[0.98]"
            style={{ background: 'var(--primary)', boxShadow: '0 4px 12px var(--primary-glow)' }}>
            + Despesa
          </button>
          <button
            type="button"
            onClick={() => onExcluir(cartao)}
            className="p-2.5 rounded-xl bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/15 transition-colors flex items-center justify-center flex-shrink-0"
            title="Excluir cartão"
            aria-label="Excluir cartão"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export function CartoesPage() {
  const navigate = useNavigate()
  const [modalAberto, setModalAberto] = useState(false)
  const [cartaoSelecionado, setCartaoSelecionado] = useState('')
  const [cartaoParaExcluir, setCartaoParaExcluir] = useState<{ id: string; nome: string } | null>(null)
  const { data: cartoes = [], isLoading, isError } = useCartoes()
  const limiteTotal = cartoes.reduce((a, c) => a + c.limite, 0)

  return (
    <div className="min-h-full bg-[var(--bg)] animate-fade-in pb-28 lg:pb-8">
      <div className="px-4 max-w-4xl mx-auto">
        <PageHeader title="Cartões" subtitle={`${cartoes.length} cartão${cartoes.length!==1?'ões':''} cadastrado${cartoes.length!==1?'s':''}`} rightAction={
          <button type="button" onClick={() => navigate('/importar-ofx')} aria-label="Importar extrato OFX"
            className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors">
            <Upload size={16} />
          </button>
        } />

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1,2].map(i=><div key={i} className="h-64 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border)] animate-pulse-soft"/>)}
          </div>
        )}
        {isError && <p className="text-sm text-[var(--danger)] py-8">Erro ao carregar. Execute setup-completo.sql no Supabase.</p>}

        {!isLoading && !isError && cartoes.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--primary-soft)] flex items-center justify-center mx-auto mb-4">
              <CreditCard size={28} className="text-[var(--primary)]" />
            </div>
            <p className="font-semibold mb-1">Nenhum cartão cadastrado</p>
            <p className="text-sm text-[var(--text-muted)] mb-5">Adicione seu primeiro cartão de crédito</p>
            <Button onClick={() => navigate('/cartoes/novo')}>Adicionar cartão</Button>
          </div>
        )}

        {cartoes.length > 0 && (
          <>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-4 mb-5" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-widest font-semibold mb-1">Limite total cadastrado</p>
              <p className="text-2xl font-bold font-mono">{formatBRL(limiteTotal)}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {cartoes.map(c => (
                <CartaoCard
                  key={c.id}
                  cartao={c}
                  onNovaDespesa={(id) => {
                    setCartaoSelecionado(id); setModalAberto(true)
                  }}
                  onExcluir={(cartaoInfo) => setCartaoParaExcluir(cartaoInfo)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <FAB onClick={() => navigate('/cartoes/novo')} label="Adicionar cartão" />

      <FormLancamentoModal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setCartaoSelecionado('') }}
        defaultTipo="despesa"
        defaultCartaoId={cartaoSelecionado}
      />

      <ConfirmarExclusaoCartaoModal
        open={!!cartaoParaExcluir}
        cartao={cartaoParaExcluir}
        onClose={() => setCartaoParaExcluir(null)}
      />
    </div>
  )
}

