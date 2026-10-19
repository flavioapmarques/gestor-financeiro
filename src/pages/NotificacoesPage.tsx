import { Bell, CreditCard, Target, AlertTriangle } from 'lucide-react'
import { useCartoes, useBancos, useMetas, useLancamentosEfetivos, useOrcamentos } from '../hooks/useData'
import { useStore } from '../lib/store'
import { gerarNotificacoes } from '../lib/alertas'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/primitives'
import { EmptyState } from '../ui/feedback'

const icons = {
  fatura: CreditCard,
  limite: AlertTriangle,
  meta: Target,
  sistema: Bell,
}

export function NotificacoesPage() {
  const { filtroMes, filtroAno } = useStore()
  const { data: cartoes = [], isLoading: l1 } = useCartoes()
  const { data: bancos = [], isLoading: l2 } = useBancos()
  const { data: metas = [], isLoading: l3 } = useMetas()
  const { data: lancamentosMes = [], isLoading: l4 } = useLancamentosEfetivos(filtroMes, filtroAno)
  const { data: orcamentos = [], isLoading: l5 } = useOrcamentos(filtroMes, filtroAno)
  const isLoading = l1 || l2 || l3 || l4 || l5

  const lista = gerarNotificacoes({ cartoes, bancos, metas, lancamentosMes, orcamentos })

  return (
    <Screen title="Notificações" subtitle="Alertas gerados a partir dos seus dados" onBack>
      {isLoading && <p className="text-center text-sm text-[var(--text-muted)] py-8">Carregando...</p>}
      {!isLoading && lista.length === 0 && (
        <EmptyState variant="transacoes" title="Nenhuma notificação" description="Alertas de fatura, limite de cartão e metas aparecerão aqui automaticamente." />
      )}
      <div className="space-y-2">
        {lista.map(n => {
          const Icon = icons[n.tipo] ?? Bell
          return (
            <Card key={n.id} padding="md" className="border-[var(--primary)]/30">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--primary-soft)] text-[var(--primary)] flex-shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.titulo}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{n.mensagem}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </Screen>
  )
}
