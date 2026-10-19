import { Sparkles, AlertTriangle, Lightbulb, TrendingUp, Heart } from 'lucide-react'
import { useCartoes, useLancamentosEfetivos, useMetas, useOrcamentos } from '../hooks/useData'
import { useStore } from '../lib/store'
import { gerarInsights } from '../lib/alertas'
import { Screen } from '../ui/Screen'
import { Card, Badge } from '../ui/primitives'
import { EmptyState } from '../ui/feedback'

const tipoConfig = {
  alerta: { icon: AlertTriangle, color: 'var(--danger)', badge: 'danger' as const },
  dica: { icon: Lightbulb, color: 'var(--warning)', badge: 'warning' as const },
  previsao: { icon: TrendingUp, color: 'var(--primary)', badge: 'default' as const },
  saude: { icon: Heart, color: 'var(--success)', badge: 'success' as const },
}

export function InsightsPage() {
  const { filtroMes, filtroAno } = useStore()
  const { data: cartoes = [], isLoading: l1 } = useCartoes()
  const { data: lancamentosMes = [], isLoading: l2 } = useLancamentosEfetivos(filtroMes, filtroAno)
  const { data: metas = [], isLoading: l3 } = useMetas()
  const { data: orcamentos = [], isLoading: l4 } = useOrcamentos(filtroMes, filtroAno)
  const isLoading = l1 || l2 || l3 || l4

  const { score, insights } = gerarInsights({ cartoes, lancamentosMes, metas, orcamentos })

  return (
    <Screen title="Insights" subtitle="Sugestões baseadas nos seus lançamentos" onBack>
      <Card className="mb-4 flex items-center gap-3 border-[var(--primary)]/30">
        <Sparkles className="text-[var(--primary)]" size={24} />
        <div>
          <p className="font-semibold text-sm">Saúde financeira</p>
          <p className="text-2xl font-bold text-[var(--primary)]">
            {isLoading ? '—' : score}<span className="text-sm text-[var(--text-muted)]">/100</span>
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">Baseado nos seus lançamentos deste mês</p>
        </div>
      </Card>

      {isLoading && <p className="text-center text-sm text-[var(--text-muted)]">Carregando...</p>}
      {!isLoading && insights.length === 0 && (
        <EmptyState variant="transacoes" title="Tudo tranquilo por aqui" description="Nenhum alerta no momento. Continue registrando seus lançamentos." />
      )}

      <div className="space-y-3">
        {insights.map(ins => {
          const cfg = tipoConfig[ins.tipo]
          const Icon = cfg.icon
          return (
            <Card key={ins.id}>
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}22` }}>
                  <Icon size={18} style={{ color: cfg.color }} />
                </div>
                <div>
                  <Badge variant={cfg.badge}>{ins.tipo}</Badge>
                  <p className="font-medium text-sm mt-1">{ins.titulo}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{ins.descricao}</p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </Screen>
  )
}
