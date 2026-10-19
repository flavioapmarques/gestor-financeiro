import { useEffect, useState } from 'react'
import { X, Check, Landmark } from 'lucide-react'
import { useBancos, usePagarFatura, useAtualizarLancamento } from '../../hooks/useData'
import { formatBRL, nomeMes } from '../../lib/utils'
import type { Banco, Lancamento } from '../../lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  cartaoId: string
  cartaoNome: string
  mes: number
  ano: number
  valor: number
  bancoPadraoId?: string
  pagamento?: (Lancamento & { banco?: Banco }) | null
}

export function PagarFaturaModal({
  open,
  onClose,
  cartaoId,
  cartaoNome,
  mes,
  ano,
  valor,
  bancoPadraoId,
  pagamento,
}: Props) {
  const { data: bancos = [] } = useBancos()
  const pagar = usePagarFatura()
  const atualizar = useAtualizarLancamento()
  const [bancoId, setBancoId] = useState(pagamento?.banco_id ?? bancoPadraoId ?? '')
  const [dataPagamento, setDataPagamento] = useState(() => pagamento?.data ?? new Date().toISOString().split('T')[0])
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open) {
      setBancoId(pagamento?.banco_id ?? bancoPadraoId ?? bancos[0]?.id ?? '')
      setDataPagamento(pagamento?.data ?? new Date().toISOString().split('T')[0])
      setErro('')
    }
  }, [open, pagamento, bancoPadraoId, bancos])

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (!bancoId) {
      setErro('Selecione a conta para débito')
      return
    }
    if (valor <= 0) {
      setErro('Não há valor a pagar nesta fatura')
      return
    }
    try {
      if (pagamento) {
        await atualizar.mutateAsync({
          id: pagamento.id,
          updates: {
            banco_id: bancoId,
            data: dataPagamento,
          },
        })
      } else {
        await pagar.mutateAsync({
          cartaoId,
          cartaoNome,
          bancoId,
          mes,
          ano,
          valor,
          dataPagamento,
        })
      }
      onClose()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
    }
  }

  if (!open) return null

  const bancoSelecionado = bancos.find((b: Banco) => b.id === bancoId)

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 md:p-4">
      <button type="button" className="absolute inset-0" aria-label="Fechar" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] sticky top-0 bg-[var(--bg-elevated)] z-10">
          <h2 className="text-base font-semibold">Pagar fatura</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center text-[var(--text-muted)]"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handlePagar} className="p-4 space-y-4 pb-8">
          <div className="rounded-2xl p-4 bg-[var(--primary-soft)] border border-[var(--primary)]/20 text-center">
            <p className="text-xs text-[var(--text-muted)] uppercase">{nomeMes(mes, ano)}</p>
            <p className="text-2xl font-bold font-mono mt-1">{formatBRL(valor)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{cartaoNome}</p>
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Conta para débito
            </label>
            {bancos.length === 0 ? (
              <p className="text-sm text-[var(--danger)]">Cadastre um banco antes de pagar a fatura.</p>
            ) : (
              <div className="space-y-2">
                {bancos.map(b => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBancoId(b.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                      bancoId === b.id
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                        : 'border-[var(--border)] bg-[var(--bg-muted)]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center">
                      <Landmark size={16} className="text-[var(--primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.instituicao} — {b.nome}</p>
                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        Saldo: {formatBRL(b.saldo_atual ?? b.saldo_inicial)}
                      </p>
                    </div>
                    {bancoId === b.id && <Check size={18} className="text-[var(--primary)] shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1 block">
              Data do pagamento
            </label>
            <input
              type="date"
              value={dataPagamento}
              onChange={e => setDataPagamento(e.target.value)}
              required
              className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>

          {bancoSelecionado && valor > (bancoSelecionado.saldo_atual ?? bancoSelecionado.saldo_inicial) && (
            <p className="text-xs text-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 rounded-lg">
              Atenção: o saldo da conta selecionada é menor que o valor da fatura.
            </p>
          )}

          {erro && (
            <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-2 rounded-lg">{erro}</p>
          )}

          <button
            type="submit"
            disabled={pagar.isPending || bancos.length === 0 || valor <= 0}
            className="w-full bg-[var(--primary)] hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-opacity flex items-center justify-center gap-2"
          >
            <Check size={18} />
            {pagar.isPending ? 'Registrando...' : 'Confirmar pagamento'}
          </button>
        </form>
      </div>
    </div>
  )
}
