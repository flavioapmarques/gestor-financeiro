import { Check, Crown } from 'lucide-react'
import { Screen } from '../ui/Screen'
import { Button, Card, Badge } from '../ui/primitives'

const beneficios = ['Insights com IA ilimitados', 'Exportação PDF de faturas', 'Metas ilimitadas', 'Suporte prioritário', 'Sem anúncios']
const comparativo = [
  { feat: 'Cartões', free: '3', premium: 'Ilimitado' },
  { feat: 'Relatórios', free: 'Básico', premium: 'Avançado' },
  { feat: 'IA', free: '—', premium: '✓' },
]

export function PremiumPage() {
  return (
    <Screen title="Premium" onBack>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#820AD1] flex items-center justify-center mx-auto mb-3">
          <Crown size={32} className="text-white" />
        </div>
        <h2 className="text-xl font-bold">Eleve suas finanças</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Controle profissional com IA</p>
      </div>

      <Card className="mb-4 border-[var(--primary)]">
        <Badge>Popular</Badge>
        <p className="text-2xl font-bold mt-2">R$ 14,90<span className="text-sm font-normal text-[var(--text-muted)]">/mês</span></p>
        <ul className="mt-4 space-y-2">
          {beneficios.map(b => (
            <li key={b} className="flex items-center gap-2 text-sm">
              <Check size={16} className="text-[var(--success)]" />{b}
            </li>
          ))}
        </ul>
        <Button className="w-full mt-6" size="lg">Assinar Premium</Button>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase text-[var(--text-muted)] mb-3">Free vs Premium</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[var(--text-muted)] text-left">
              <th className="pb-2">Recurso</th><th>Free</th><th>Premium</th>
            </tr>
          </thead>
          <tbody>
            {comparativo.map(c => (
              <tr key={c.feat} className="border-t border-[var(--border)]">
                <td className="py-2">{c.feat}</td>
                <td className="text-[var(--text-muted)]">{c.free}</td>
                <td className="text-[var(--primary)] font-medium">{c.premium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Screen>
  )
}
