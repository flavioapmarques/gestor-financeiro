import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts'
import { formatBRL } from '../../lib/utils'
import { Card, SectionTitle } from '../../ui/primitives'

interface EvolucaoMensalCardProps {
  chartData: { m: string; r: number; d: number }[]
}

/** Isolado num arquivo próprio para que o Recharts (biblioteca pesada) não entre
 * no bundle inicial da Home — é carregado sob demanda via React.lazy. */
export default function EvolucaoMensalCard({ chartData }: EvolucaoMensalCardProps) {
  return (
    <Card padding="lg">
      <SectionTitle title="Evolução dos últimos 6 meses" />
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="m" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number, name: string) => [formatBRL(v), name === 'r' ? 'Receitas' : 'Despesas']}
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11 }}
            />
            <Area type="monotone" dataKey="r" stroke="var(--success)" fill="url(#gR)" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="d" stroke="var(--danger)" fill="url(#gD)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)]" />Receitas
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--danger)]" />Despesas
        </span>
      </div>
    </Card>
  )
}
