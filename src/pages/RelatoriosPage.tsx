import { useState } from 'react'
import { Download, X, ChevronRight, ArrowUp, ArrowDown, Minus, CreditCard } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useCartoes, useLancamentos, useLancamentosAno, useLancamentosEfetivos, useLancamentosAnoEfetivo, useBancos } from '../hooks/useData'
import { isPagamentoFatura } from '../lib/lancamentos'
import { useStore } from '../lib/store'
import { formatBRL, mesAnterior, nomeMes } from '../lib/utils'
import { Screen } from '../ui/Screen'
import { Card, Chip, SectionTitle, Button } from '../ui/primitives'
import { TxIcon } from '../ui/finance'
import type { Lancamento } from '../lib/supabase'

const CORES_FALLBACK = ['#9D4EDD', '#FF6B6B', '#3D5AFE', '#00C48C', '#FFB020', '#6B7280']

function exportarCSV(lancamentos: Lancamento[]) {
  const linhas = [
    ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Cartão', 'Valor'],
    ...lancamentos.map(l => [
      l.data,
      l.descricao,
      l.tipo,
      l.categoria?.nome ?? '',
      l.banco?.nome ?? '',
      l.cartao?.nome ?? '',
      String(l.valor).replace('.', ','),
    ]),
  ]
  const csv = linhas.map(linha => linha.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lancamentos-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<'mes' | 'ano'>('mes')
  const { filtroMes, filtroAno } = useStore()
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null)
  const { data: cartoes = [] } = useCartoes()
  const { data: bancos = [] } = useBancos()

  // Dataset principal: agrupado pelo mês em que o dinheiro realmente saiu (mês de pagamento
  // da fatura pro cartão), não pela data da compra. O pagamento da fatura em si já vem excluído.
  const { data: lancamentosMes = [] } = useLancamentosEfetivos(filtroMes, filtroAno)
  const { data: lancamentosAno = [] } = useLancamentosAnoEfetivo(filtroAno)

  const { mes: mesAnt, ano: anoAntMes } = mesAnterior(filtroMes, filtroAno)
  const { data: lancamentosMesAnterior = [] } = useLancamentosEfetivos(mesAnt, anoAntMes)
  const { data: lancamentosAnoAnterior = [] } = useLancamentosAnoEfetivo(filtroAno - 1)

  // Dataset bruto: só pro "Resumo por conta", que precisa refletir a movimentação real da
  // conta (incluindo o pagamento da fatura, que de fato saiu do banco naquele dia).
  const { data: lancamentosMesBruto = [] } = useLancamentos(filtroMes, filtroAno)
  const { data: lancamentosAnoBruto = [] } = useLancamentosAno(filtroAno)

  const lancamentos = periodo === 'ano' ? lancamentosAno : lancamentosMes
  const lancamentosAnterior = periodo === 'ano' ? lancamentosAnoAnterior : lancamentosMesAnterior
  const lancamentosBrutoConta = periodo === 'ano' ? lancamentosAnoBruto : lancamentosMesBruto
  const labelPeriodoAnterior = periodo === 'ano' ? String(filtroAno - 1) : nomeMes(mesAnt, anoAntMes)

  // O dataset "efetivo" já vem sem pagamentos de fatura (evita duplicar o gasto: a compra
  // isolada já representa o dinheiro que saiu, atribuída ao mês certo).
  const lancamentosFiltrados = lancamentos
  const lancamentosAnteriorFiltrados = lancamentosAnterior

  const pizzaMap = new Map<string, { name: string; value: number; categoriaId: string | null; cor: string }>()
  for (const l of lancamentosFiltrados) {
    if (l.tipo !== 'despesa') continue
    const nome = l.categoria?.nome ?? 'Outros'
    const chave = l.categoria_id ?? 'sem-categoria'
    const atual = pizzaMap.get(chave)
    pizzaMap.set(chave, {
      name: nome,
      value: (atual?.value ?? 0) + l.valor,
      categoriaId: l.categoria_id ?? null,
      cor: l.categoria?.cor ?? CORES_FALLBACK[pizzaMap.size % CORES_FALLBACK.length],
    })
  }
  const pizza = Array.from(pizzaMap.values()).sort((a, b) => b.value - a.value)
  const totalDespesasPizza = pizza.reduce((a, p) => a + p.value, 0)

  const categoriaAtiva = pizza.find(p => (p.categoriaId ?? 'sem-categoria') === categoriaSelecionada)
  const lancamentosDaCategoria = categoriaSelecionada
    ? lancamentosFiltrados
        .filter(l => l.tipo === 'despesa' && (l.categoria_id ?? 'sem-categoria') === categoriaSelecionada)
        .sort((a, b) => (b.data_vencimento_parcela ?? b.data).localeCompare(a.data_vencimento_parcela ?? a.data))
    : []

  const porCartao = cartoes.map(c => ({
    name: c.nome,
    value: lancamentosFiltrados.filter(l => l.cartao_id === c.id && l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0),
  })).filter(c => c.value > 0)

  const receitas = lancamentosFiltrados.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const despesas = lancamentosFiltrados.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0)
  const receitasAnt = lancamentosAnteriorFiltrados.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const despesasAnt = lancamentosAnteriorFiltrados.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0)
  const variacaoDespesas = despesasAnt > 0 ? ((despesas - despesasAnt) / despesasAnt) * 100 : null
  const variacaoReceitas = receitasAnt > 0 ? ((receitas - receitasAnt) / receitasAnt) * 100 : null

  const gastoPorCategoriaAnt = new Map<string, number>()
  for (const l of lancamentosAnteriorFiltrados) {
    if (l.tipo !== 'despesa') continue
    const chave = l.categoria_id ?? 'sem-categoria'
    gastoPorCategoriaAnt.set(chave, (gastoPorCategoriaAnt.get(chave) ?? 0) + l.valor)
  }
  const chavesCategorias = new Set([...pizzaMap.keys(), ...gastoPorCategoriaAnt.keys()])
  const variacoesCategoria = Array.from(chavesCategorias).map(chave => {
    const atual = pizzaMap.get(chave)
    const valorAtual = atual?.value ?? 0
    const valorAnt = gastoPorCategoriaAnt.get(chave) ?? 0
    return {
      nome: atual?.name ?? 'Categoria removida',
      cor: atual?.cor ?? CORES_FALLBACK[0],
      valorAtual,
      valorAnt,
      diff: valorAtual - valorAnt,
      pct: valorAnt > 0 ? ((valorAtual - valorAnt) / valorAnt) * 100 : null,
    }
  })
    .filter(v => Math.abs(v.diff) >= 1) // ignora diferenças irrelevantes (centavos)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 5)

  const lancamentosComObs = [...lancamentosFiltrados]
    .filter(l => l.observacao?.trim())
    .sort((a, b) => b.data.localeCompare(a.data))

  const resumoPorConta = bancos.map(banco => {
    const receitasConta = lancamentosBrutoConta
      .filter(l => l.tipo === 'receita' && l.banco_id === banco.id)
      .reduce((acc, l) => acc + l.valor, 0)
    // Débito/PIX direto da conta (o pagamento da fatura em si fica de fora — ele é
    // substituído pelo gasto de cartão abaixo, já atribuído ao mês certo, pra não duplicar).
    const despesasContaDireta = lancamentosBrutoConta
      .filter(l => l.tipo === 'despesa' && l.banco_id === banco.id && !isPagamentoFatura(l.tags))
      .reduce((acc, l) => acc + l.valor, 0)
    // Gasto nos cartões que têm essa conta configurada como pagadora, no mês efetivo (de pagamento).
    const despesasCartaoVinculado = lancamentosFiltrados
      .filter(l => l.tipo === 'despesa' && l.cartao_id && cartoes.find(c => c.id === l.cartao_id)?.banco_pagamento_id === banco.id)
      .reduce((acc, l) => acc + l.valor, 0)
    const despesasConta = despesasContaDireta + despesasCartaoVinculado
    const transferenciasSaida = lancamentosBrutoConta
      .filter(l => l.tipo === 'transferencia' && l.banco_id === banco.id)
      .reduce((acc, l) => acc + l.valor, 0)
    const transferenciasEntrada = lancamentosBrutoConta
      .filter(l => l.tipo === 'transferencia' && l.banco_destino_id === banco.id)
      .reduce((acc, l) => acc + l.valor, 0)

    return {
      id: banco.id,
      nome: banco.nome,
      instituicao: banco.instituicao,
      receitasConta,
      despesasConta,
      despesasCartaoVinculado,
      transferenciasSaida,
      transferenciasEntrada,
      liquido: receitasConta + transferenciasEntrada - despesasConta - transferenciasSaida,
    }
  })

  return (
    <Screen title="Relatórios" subtitle={periodo === 'ano' ? `Análises do ano de ${filtroAno}` : 'Análises e tendências'}>
      <div className="flex flex-wrap gap-2 mb-4">
        <Chip active={periodo === 'mes'} onClick={() => { setPeriodo('mes'); setCategoriaSelecionada(null) }}>Mês atual</Chip>
        <Chip active={periodo === 'ano'} onClick={() => { setPeriodo('ano'); setCategoriaSelecionada(null) }}>Ano</Chip>
      </div>

      <Button variant="outline" size="sm" className="mb-4 w-full" onClick={() => exportarCSV(lancamentosFiltrados)}>
        <Download size={14} /> Exportar CSV ({lancamentosFiltrados.length} lançamentos)
      </Button>

      <Card className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-[var(--text-muted)] text-xs">Receitas</p><p className="font-mono text-[var(--success)]">{formatBRL(receitas)}</p></div>
        <div><p className="text-[var(--text-muted)] text-xs">Despesas</p><p className="font-mono text-[var(--danger)]">{formatBRL(despesas)}</p></div>
      </Card>

      <Card className="mb-4">
        <SectionTitle title={`Revisão vs. ${labelPeriodoAnterior}`} />
        <div className="grid grid-cols-2 gap-3 mb-1">
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Receitas</p>
            <p className="font-mono text-sm font-bold text-[var(--success)]">{formatBRL(receitas)}</p>
            {variacaoReceitas === null ? (
              <p className="text-[10px] text-[var(--text-subtle)] mt-1">Sem dado anterior</p>
            ) : (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${variacaoReceitas >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {variacaoReceitas === 0 ? <Minus size={11} /> : variacaoReceitas > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {Math.abs(variacaoReceitas).toFixed(0)}%
              </div>
            )}
          </div>
          <div className="rounded-xl bg-[var(--bg-muted)] p-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">Despesas</p>
            <p className="font-mono text-sm font-bold text-[var(--danger)]">{formatBRL(despesas)}</p>
            {variacaoDespesas === null ? (
              <p className="text-[10px] text-[var(--text-subtle)] mt-1">Sem dado anterior</p>
            ) : (
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-semibold ${variacaoDespesas <= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                {variacaoDespesas === 0 ? <Minus size={11} /> : variacaoDespesas > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {Math.abs(variacaoDespesas).toFixed(0)}%
              </div>
            )}
          </div>
        </div>

        {variacoesCategoria.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2">Maiores variações por categoria</p>
            <div className="space-y-2">
              {variacoesCategoria.map(v => {
                const aumentou = v.diff > 0
                return (
                  <div key={v.nome} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.cor }} />
                      <span className="text-xs font-medium truncate">{v.nome}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-mono font-semibold flex-shrink-0 ${aumentou ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                      {aumentou ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                      {formatBRL(Math.abs(v.diff))}
                      {v.pct !== null && <span className="text-[var(--text-subtle)] font-normal">({aumentou ? '+' : ''}{v.pct.toFixed(0)}%)</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <SectionTitle title="Por categoria" />
        <p className="text-[10px] text-[var(--text-muted)] -mt-2 mb-3">
          Compras no cartão entram no mês em que a fatura é paga (não no mês da compra). O pagamento da fatura em si não conta aqui — a compra já representa o gasto.
        </p>
        {pizza.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">Sem despesas no período</p>
        ) : (
          <>
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pizza}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={90}
                    paddingAngle={2}
                    cornerRadius={4}
                    stroke="var(--bg-elevated)"
                    strokeWidth={2}
                    onClick={(d: any) => {
                      const chave = d.categoriaId ?? 'sem-categoria'
                      setCategoriaSelecionada(prev => prev === chave ? null : chave)
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {pizza.map((p, i) => {
                      const chave = p.categoriaId ?? 'sem-categoria'
                      const ativa = categoriaSelecionada === null || categoriaSelecionada === chave
                      return (
                        <Cell
                          key={i}
                          fill={p.cor}
                          opacity={ativa ? 1 : 0.25}
                          className="outline-none transition-opacity duration-200"
                        />
                      )
                    })}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.[0]) return null
                      const p = payload[0].payload
                      const pct = totalDespesasPizza > 0 ? (p.value / totalDespesasPizza) * 100 : 0
                      return (
                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 shadow-lg" style={{ boxShadow: 'var(--shadow-card)' }}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="w-2 h-2 rounded-full" style={{ background: p.cor }} />
                            <span className="text-xs font-semibold">{p.name}</span>
                          </div>
                          <p className="text-sm font-mono font-bold text-[var(--danger)]">{formatBRL(p.value)}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{pct.toFixed(1)}% do total</p>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Total no centro do donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Total</p>
                <p className="text-lg font-mono font-bold text-[var(--danger)]">{formatBRL(totalDespesasPizza)}</p>
              </div>
            </div>

            {/* Legenda estilo lista, clicável */}
            <div className="space-y-2 mt-3">
              {pizza.map(p => {
                const chave = p.categoriaId ?? 'sem-categoria'
                const pct = totalDespesasPizza > 0 ? (p.value / totalDespesasPizza) * 100 : 0
                const selecionada = categoriaSelecionada === chave
                return (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setCategoriaSelecionada(prev => prev === chave ? null : chave)}
                    className={`w-full text-left rounded-xl p-2.5 border transition-colors ${
                      selecionada ? 'border-[var(--primary)]/50 bg-[var(--primary-soft)]' : 'border-transparent hover:bg-[var(--bg-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.cor }} />
                        <span className="text-xs font-semibold truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-[var(--danger)]">{formatBRL(p.value)}</span>
                        <ChevronRight size={13} className={`text-[var(--text-subtle)] transition-transform ${selecionada ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: p.cor }} />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Drill-down: lançamentos da categoria selecionada */}
            {categoriaAtiva && (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
                    {lancamentosDaCategoria.length} lançamento{lancamentosDaCategoria.length > 1 ? 's' : ''} em "{categoriaAtiva.name}"
                  </p>
                  <button type="button" onClick={() => setCategoriaSelecionada(null)} aria-label="Fechar" className="text-[var(--text-subtle)] hover:text-[var(--text)]">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {lancamentosDaCategoria.map(l => (
                    <div key={l.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                      <TxIcon tipo={l.tipo} cor={l.categoria?.cor} viaCartao={!!l.cartao_id} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{l.descricao}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {new Date(`${l.data_vencimento_parcela ?? l.data}T12:00:00`).toLocaleDateString('pt-BR')}
                          {l.cartao_id ? ' · pago no cartão' : ''}
                          {l.cartao && ` · ${l.cartao.nome}`}
                          {l.banco && !l.cartao && ` · ${l.banco.nome}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {l.cartao_id && <CreditCard size={13} className="text-[var(--primary)]" />}
                        <p className="text-sm font-mono font-bold text-[var(--danger)]">-{formatBRL(l.valor)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {porCartao.length > 0 && (
        <Card className="mb-4">
          <SectionTitle title="Por cartão" />
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCartao} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {resumoPorConta.length > 0 && (
        <Card className="mb-4">
          <SectionTitle title="Resumo por conta" />
          <div className="space-y-3">
            {resumoPorConta.map(conta => (
              <div key={conta.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{conta.nome}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">{conta.instituicao}</p>
                  </div>
                  <p className={`text-sm font-semibold font-mono ${conta.liquido >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {formatBRL(conta.liquido)}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-[var(--text-muted)]">Receitas</p>
                    <p className="font-mono text-[var(--success)]">+{formatBRL(conta.receitasConta)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Despesas</p>
                    <p className="font-mono text-[var(--danger)]">-{formatBRL(conta.despesasConta)}</p>
                    {conta.despesasCartaoVinculado > 0 && (
                      <p className="text-[9px] text-[var(--text-subtle)] flex items-center gap-1 mt-0.5">
                        <CreditCard size={9} /> inclui {formatBRL(conta.despesasCartaoVinculado)} de cartão
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Transfer. saída</p>
                    <p className="font-mono text-[var(--danger)]">-{formatBRL(conta.transferenciasSaida)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-muted)]">Transfer. entrada</p>
                    <p className="font-mono text-[var(--success)]">+{formatBRL(conta.transferenciasEntrada)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lancamentosComObs.length > 0 && (
        <Card className="mb-4">
          <SectionTitle title="Observações do período" />
          <div className="space-y-3">
            {lancamentosComObs.map(l => (
              <div key={l.id} className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium truncate">{l.descricao}</p>
                  <span className="text-[11px] text-[var(--text-muted)]">{l.data}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{l.observacao}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="Resumo" />
        <p className="text-sm text-[var(--text-muted)]">
          {despesas > receitas
            ? `Despesas ${formatBRL(despesas - receitas)} acima das receitas neste mês.`
            : `Economia de ${formatBRL(receitas - despesas)} no período.`}
        </p>
      </Card>
    </Screen>
  )
}
