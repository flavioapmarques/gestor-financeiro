import type { Banco, Cartao, Lancamento, Meta, Orcamento } from './supabase'

export interface AlertaGerado {
  id: string
  tipo: 'alerta' | 'dica' | 'previsao' | 'saude'
  titulo: string
  descricao: string
}

export interface NotificacaoGerada {
  id: string
  tipo: 'fatura' | 'limite' | 'meta' | 'sistema'
  titulo: string
  mensagem: string
}

export interface ResumoMensal {
  receita: number
  despesa: number
  saldoLiquido: number
  economia: number
  taxaEconomia: number
  alerta: 'saudavel' | 'atencao' | 'critico'
  topCategoria: string | null
  topCategoriaValor: number
}

export function gerarResumoMensal(params: {
  lancamentosMes: Lancamento[]
  cartoes: Cartao[]
  metas: Meta[]
  orcamentos?: Orcamento[]
}): ResumoMensal {
  const { lancamentosMes, cartoes = [], metas = [], orcamentos = [] } = params

  const receita = lancamentosMes
    .filter(l => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesa = lancamentosMes
    .filter(l => l.tipo === 'despesa' && !isPagamentoFatura(l.tags))
    .reduce((sum, l) => sum + l.valor, 0)

  const saldoLiquido = receita - despesa
  const economia = saldoLiquido > 0 ? saldoLiquido : 0
  const taxaEconomia = receita > 0 ? Math.max(0, (receita - despesa) / receita) : 0

  const gastoPorCategoria = new Map<string, number>()
  for (const l of lancamentosMes) {
    if (l.tipo !== 'despesa' || isPagamentoFatura(l.tags)) continue
    const nome = l.categoria?.nome ?? 'Outros'
    gastoPorCategoria.set(nome, (gastoPorCategoria.get(nome) ?? 0) + l.valor)
  }

  let topCategoria: string | null = null
  let topCategoriaValor = 0
  for (const [nome, valor] of gastoPorCategoria.entries()) {
    if (valor > topCategoriaValor) {
      topCategoria = nome
      topCategoriaValor = valor
    }
  }

  let alerta: ResumoMensal['alerta'] = 'saudavel'
  if (receita > 0 && despesa > receita) alerta = 'critico'
  else if (receita > 0 && taxaEconomia < 0.15) alerta = 'atencao'

  const cartoesComLimite = cartoes.filter(c => c.limite > 0)
  const usoMedio = cartoesComLimite.length > 0
    ? cartoesComLimite.reduce((sum, c) => {
        const usado = lancamentosMes
          .filter(l => l.cartao_id === c.id && l.tipo === 'despesa')
          .reduce((acc, l) => acc + l.valor, 0)
        return sum + (c.limite > 0 ? usado / c.limite : 0)
      }, 0) / cartoesComLimite.length
    : 0

  if (usoMedio >= 0.85) alerta = 'critico'
  else if (usoMedio >= 0.7 || (receita > 0 && taxaEconomia < 0.2)) alerta = 'atencao'

  const orcamentosAtivos = orcamentos.filter(o => o.valor_limite > 0)
  if (orcamentosAtivos.length > 0) {
    const emRisco = orcamentosAtivos.some(o => {
      const gasto = lancamentosMes
        .filter(l => l.tipo === 'despesa' && l.categoria_id === o.categoria_id && !isPagamentoFatura(l.tags))
        .reduce((sum, l) => sum + l.valor, 0)
      return gasto >= o.valor_limite * 0.9
    })
    if (emRisco && alerta === 'saudavel') alerta = 'atencao'
  }

  return {
    receita,
    despesa,
    saldoLiquido,
    economia,
    taxaEconomia,
    alerta,
    topCategoria,
    topCategoriaValor,
  }
}

function diasAteProximoVencimento(diaVencimento: number, hoje: Date): number {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  let venc = new Date(ano, mes, diaVencimento)
  if (venc < hoje) venc = new Date(ano, mes + 1, diaVencimento)
  return Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
}

function usoCartao(cartao: Cartao, lancamentosMes: Lancamento[]): number {
  const usado = lancamentosMes
    .filter(l => l.cartao_id === cartao.id && l.tipo === 'despesa')
    .reduce((a, l) => a + l.valor, 0)
  return cartao.limite > 0 ? usado / cartao.limite : 0
}

function isPagamentoFatura(tags?: string[] | null): boolean {
  return tags?.some(t => t.startsWith('fatura:')) ?? false
}

function usoOrcamento(orc: Orcamento, lancamentosMes: Lancamento[]): number {
  const gasto = lancamentosMes
    .filter(l => l.tipo === 'despesa' && l.categoria_id === orc.categoria_id && !isPagamentoFatura(l.tags))
    .reduce((a, l) => a + l.valor, 0)
  return orc.valor_limite > 0 ? gasto / orc.valor_limite : 0
}

/** Calcula um score de 0 a 100 e uma lista de insights, tudo derivado dos dados já carregados. */
export function gerarInsights(params: {
  cartoes: Cartao[]
  lancamentosMes: Lancamento[]
  metas: Meta[]
  orcamentos?: Orcamento[]
}): { score: number; insights: AlertaGerado[] } {
  const { cartoes, lancamentosMes, metas, orcamentos = [] } = params
  const insights: AlertaGerado[] = []

  const receitas = lancamentosMes.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const despesas = lancamentosMes.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0)

  // ── Score de saúde financeira ──
  let score = 60
  if (receitas > 0) {
    const taxaEconomia = (receitas - despesas) / receitas
    score += taxaEconomia * 40
  } else if (despesas > 0) {
    score -= 20
  }
  const cartoesComLimite = cartoes.filter(c => c.limite > 0)
  const usoMedio = cartoesComLimite.length > 0
    ? cartoesComLimite.reduce((a, c) => a + usoCartao(c, lancamentosMes), 0) / cartoesComLimite.length
    : 0
  if (usoMedio > 0.7) score -= (usoMedio - 0.7) * 100
  score = Math.max(0, Math.min(100, Math.round(score)))

  // ── Alerta: despesas acima das receitas ──
  if (receitas > 0 && despesas > receitas) {
    insights.push({
      id: 'alerta-despesas-receitas',
      tipo: 'alerta',
      titulo: 'Despesas acima das receitas',
      descricao: `Neste mês as despesas já superam as receitas em ${(despesas - receitas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  // ── Alerta: cartões com uso alto ──
  for (const c of cartoesComLimite) {
    const uso = usoCartao(c, lancamentosMes)
    if (uso >= 0.7) {
      insights.push({
        id: `alerta-cartao-${c.id}`,
        tipo: 'alerta',
        titulo: `Cartão ${c.nome} com uso alto`,
        descricao: `Você já usou ${Math.round(uso * 100)}% do limite deste cartão neste mês.`,
      })
    }
  }

  // ── Alerta: orçamentos estourados ou quase no limite ──
  for (const orc of orcamentos) {
    const uso = usoOrcamento(orc, lancamentosMes)
    if (uso >= 1) {
      insights.push({
        id: `orcamento-estourado-${orc.id}`,
        tipo: 'alerta',
        titulo: `Orçamento de ${orc.categoria?.nome ?? 'categoria'} estourado`,
        descricao: `Você já ultrapassou em ${Math.round((uso - 1) * 100)}% o limite definido para essa categoria neste mês.`,
      })
      score -= 8
    } else if (uso >= 0.9) {
      insights.push({
        id: `orcamento-quase-${orc.id}`,
        tipo: 'alerta',
        titulo: `Orçamento de ${orc.categoria?.nome ?? 'categoria'} quase no limite`,
        descricao: `Você já usou ${Math.round(uso * 100)}% do valor reservado para essa categoria neste mês.`,
      })
    }
  }
  score = Math.max(0, Math.min(100, Math.round(score)))


  const porCategoria = new Map<string, number>()
  for (const l of lancamentosMes) {
    if (l.tipo !== 'despesa') continue
    if (isPagamentoFatura(l.tags)) continue
    const nome = l.categoria?.nome ?? 'Outros'
    porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + l.valor)
  }
  const topCategoria = Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topCategoria && despesas > 0) {
    const [nome, valor] = topCategoria
    const pct = Math.round((valor / despesas) * 100)
    if (pct >= 30) {
      insights.push({
        id: 'dica-top-categoria',
        tipo: 'dica',
        titulo: `${nome} concentra boa parte dos seus gastos`,
        descricao: `${pct}% das despesas do mês estão em "${nome}". Vale revisar se dá para reduzir.`,
      })
    }
  }

  // ── Previsão: ritmo de gasto do mês ──
  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  if (diaAtual >= 5 && despesas > 0) {
    const projecao = (despesas / diaAtual) * diasNoMes
    if (receitas > 0 && projecao > receitas * 1.05) {
      insights.push({
        id: 'previsao-projecao-mes',
        tipo: 'previsao',
        titulo: 'Projeção de gastos do mês',
        descricao: `No ritmo atual, as despesas devem fechar em torno de ${projecao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} até o fim do mês.`,
      })
    }
  }

  // ── Saúde: metas próximas de concluir ──
  const metaProxima = metas.find(m => !m.concluida && m.valor_alvo > 0 && m.valor_atual / m.valor_alvo >= 0.9)
  if (metaProxima) {
    insights.push({
      id: `saude-meta-${metaProxima.id}`,
      tipo: 'saude',
      titulo: `Quase lá: "${metaProxima.nome}"`,
      descricao: `Faltam apenas ${(metaProxima.valor_alvo - metaProxima.valor_atual).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para concluir essa meta.`,
    })
  }

  return { score, insights }
}

/** Gera a lista de notificações/alertas ativos a partir dos dados já carregados. */
export function gerarNotificacoes(params: {
  cartoes: Cartao[]
  bancos: Banco[]
  metas: Meta[]
  lancamentosMes: Lancamento[]
  orcamentos?: Orcamento[]
}): NotificacaoGerada[] {
  const { cartoes, bancos, metas, lancamentosMes, orcamentos = [] } = params
  const hoje = new Date()
  const notificacoes: NotificacaoGerada[] = []

  for (const orc of orcamentos) {
    const uso = usoOrcamento(orc, lancamentosMes)
    if (uso >= 1) {
      notificacoes.push({
        id: `orcamento-${orc.id}`,
        tipo: 'limite',
        titulo: `Orçamento de ${orc.categoria?.nome ?? 'categoria'} estourado`,
        mensagem: `Você ultrapassou o limite definido para essa categoria neste mês.`,
      })
    }
  }

  for (const c of cartoes) {
    const dias = diasAteProximoVencimento(c.dia_vencimento, hoje)
    if (dias <= 5) {
      notificacoes.push({
        id: `fatura-${c.id}`,
        tipo: 'fatura',
        titulo: `Fatura do ${c.nome} vence ${dias <= 0 ? 'hoje' : `em ${dias} dia${dias > 1 ? 's' : ''}`}`,
        mensagem: `Confira o valor da fatura antes do vencimento para evitar juros.`,
      })
    }
    const uso = usoCartao(c, lancamentosMes)
    if (uso >= 0.7) {
      notificacoes.push({
        id: `limite-${c.id}`,
        tipo: 'limite',
        titulo: `Limite do ${c.nome} quase no fim`,
        mensagem: `Você já usou ${Math.round(uso * 100)}% do limite disponível neste cartão.`,
      })
    }
  }

  for (const b of bancos) {
    const saldo = b.saldo_atual ?? b.saldo_inicial
    if (saldo < 0) {
      notificacoes.push({
        id: `saldo-negativo-${b.id}`,
        tipo: 'sistema',
        titulo: `Saldo negativo em ${b.instituicao}`,
        mensagem: `A conta "${b.nome}" está com saldo negativo de ${Math.abs(saldo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
      })
    }
  }

  for (const m of metas) {
    if (m.concluida) continue
    if (m.valor_alvo > 0 && m.valor_atual / m.valor_alvo >= 1) {
      notificacoes.push({
        id: `meta-concluida-${m.id}`,
        tipo: 'meta',
        titulo: `Meta "${m.nome}" atingida! 🎉`,
        mensagem: `Parabéns! Você alcançou o valor alvo dessa meta.`,
      })
    }
  }

  return notificacoes
}
