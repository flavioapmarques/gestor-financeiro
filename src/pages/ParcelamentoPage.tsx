import { useState } from 'react'
import { Screen } from '../ui/Screen'
import { Card, Input, SectionTitle } from '../ui/primitives'
import { formatBRL } from '../lib/utils'
import { ProgressBar } from '../ui/finance'

export function ParcelamentoPage() {
  const [total, setTotal] = useState(900)
  const [parcelas, setParcelas] = useState(10)
  const valorParcela = total / parcelas

  const faturas = Array.from({ length: Math.min(parcelas, 6) }, (_, i) => ({
    mes: ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov'][i],
    valor: valorParcela,
  }))

  return (
    <Screen title="Simular parcelamento" subtitle="Impacto nas próximas faturas" onBack>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor total" type="number" value={total} onChange={e => setTotal(Number(e.target.value))} />
          <Input label="Parcelas" type="number" min={2} max={48} value={parcelas} onChange={e => setParcelas(Number(e.target.value))} />
        </div>
        <div className="mt-4 p-4 rounded-xl bg-[var(--primary-soft)] text-center">
          <p className="text-xs text-[var(--text-muted)]">Valor por parcela</p>
          <p className="text-2xl font-bold font-mono text-[var(--primary)]">{formatBRL(valorParcela)}</p>
        </div>
      </Card>

      <SectionTitle title="Calendário financeiro" />
      <div className="space-y-2">
        {faturas.map((f, i) => (
          <Card key={i} padding="sm" className="flex justify-between items-center">
            <span className="text-sm font-medium">{f.mes}/2026</span>
            <span className="font-mono text-sm">{formatBRL(f.valor)}</span>
          </Card>
        ))}
        {parcelas > 6 && <p className="text-xs text-center text-[var(--text-muted)]">+ {parcelas - 6} parcelas</p>}
      </div>

      <Card className="mt-4">
        <p className="text-xs text-[var(--text-muted)] mb-2">Comprometimento do limite</p>
        <ProgressBar value={valorParcela * 3} max={total} />
      </Card>
    </Screen>
  )
}
