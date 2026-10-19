import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useDeletarCartao } from '../../hooks/useData'
import { Button } from '../../ui/primitives'

interface Props {
  open: boolean
  cartao: { id: string; nome: string } | null
  onClose: () => void
  onSuccess?: () => void
}

export function ConfirmarExclusaoCartaoModal({
  open,
  cartao,
  onClose,
  onSuccess,
}: Props) {
  const deletar = useDeletarCartao()
  const [erro, setErro] = useState('')

  if (!open || !cartao) return null

  async function handleConfirmar() {
    if (!cartao) return
    setErro('')
    try {
      await deletar.mutateAsync(cartao.id)
      onClose()
      if (onSuccess) onSuccess()
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao excluir cartão e seus lançamentos')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={deletar.isPending ? undefined : onClose}
    >
      <div
        className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-[var(--danger)]/15 text-[var(--danger)] flex items-center justify-center mx-auto">
          <AlertTriangle size={26} />
        </div>

        <div className="text-center">
          <h3 className="text-lg font-bold text-[var(--text)]">
            Excluir o cartão &ldquo;{cartao.nome}&rdquo;?
          </h3>
          <p className="text-xs text-[var(--danger)] font-semibold mt-1">
            Esta ação é irreversível e apagará dados vinculados.
          </p>
        </div>

        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/25 rounded-xl p-3.5 space-y-2 text-xs text-[var(--text-muted)] leading-relaxed">
          <p>
            💥 <strong>Aviso importante:</strong> Todos os dados já lançados neste cartão serão <strong>excluídos permanentemente</strong> (despesas, compras parceladas e registros de fatura).
          </p>
          <p>
            🏦 <strong>Impacto nas contas:</strong> Essa exclusão pode <strong>interferir nos lançamentos anteriores</strong> e alterar o <strong>saldo total das contas bancárias</strong> onde os pagamentos de fatura deste cartão haviam sido debitados.
          </p>
        </div>

        {erro && (
          <p className="text-xs text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg p-2.5">
            {erro}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={deletar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            loading={deletar.isPending}
            onClick={handleConfirmar}
          >
            Sim, excluir tudo
          </Button>
        </div>
      </div>
    </div>
  )
}
