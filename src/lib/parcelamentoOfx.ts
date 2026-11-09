import { mesVencimentoFatura } from './lancamentos'
import { proximoMes } from './utils'
import type { Lancamento } from './supabase'
import type { TransacaoOfx } from './ofx'

export interface DetalhesParcelamento {
  parcelado: boolean
  parcelaAtual?: number
  totalParcelas?: number
  descricaoBase: string
  dataCompraDetectada?: string // YYYY-MM-DD se encontrada na descrição
}

export interface DatasCartao {
  dataCompra: string
  dataVencimentoParcela: string
  mesReferencia: number
  anoReferencia: number
  mesAnoFormatado: string // ex: "Dez/2026"
}

export interface ParcelaFuturaGerada {
  parcela_atual: number
  total_parcelas: number
  valor: number
  data: string // data original da compra
  data_vencimento_parcela: string
  descricao: string
  categoria_id?: string
  observacao?: string
  cartao_id: string
  grupo_parcela_id: string
  efetivado: boolean
  tipo: 'despesa'
  tags: string[]
}

const NOMES_MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

/**
 * Extrai dados de parcelamento e data de compra a partir do texto descritivo de uma transação OFX.
 */
export function extrairDadosParcelamentoDescricao(
  descricao: string,
  anoReferencia: number = new Date().getFullYear(),
): DetalhesParcelamento {
  const texto = (descricao || '').trim()
  if (!texto) {
    return { parcelado: false, descricaoBase: '' }
  }

  let dataCompraDetectada: string | undefined
  let parcelaAtual: number | undefined
  let totalParcelas: number | undefined
  let trechoParcela: string | undefined

  // 1. Primeiro verifica se há padrão explícito com prefixo PARC / PARCELA
  const regexParcPrefixo = /(?:PARC\.?|PARCELA)\s*\(?(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})\)?/i
  const matchPrefixo = texto.match(regexParcPrefixo)
  if (matchPrefixo) {
    const p1 = parseInt(matchPrefixo[1], 10)
    const p2 = parseInt(matchPrefixo[2], 10)
    if (p1 >= 1 && p2 >= 2 && p2 <= 48 && p1 <= p2) {
      parcelaAtual = p1
      totalParcelas = p2
      trechoParcela = matchPrefixo[0]
    }
  }

  // 2. Se não encontrou prefixo, busca entre parênteses/colchetes: (02/06) ou [2/6]
  if (!trechoParcela) {
    const regexParenteses = /[\(\[]\s*(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})\s*[\)\]]/i
    const matchParenteses = texto.match(regexParenteses)
    if (matchParenteses) {
      const p1 = parseInt(matchParenteses[1], 10)
      const p2 = parseInt(matchParenteses[2], 10)
      if (p1 >= 1 && p2 >= 2 && p2 <= 48 && p1 <= p2) {
        parcelaAtual = p1
        totalParcelas = p2
        trechoParcela = matchParenteses[0]
      }
    }
  }

  // 3. Se ainda não encontrou, busca todos os candidatos "XX/YY" ou "XX DE YY" no texto
  const regexTodosPadroes = /(?:^|\s+-\s+|\s+)(\d{1,2})\s*(?:\/|\s+DE\s+)\s*(\d{1,2})(?=\s+|$)/gi
  const todosMatches = Array.from(texto.matchAll(regexTodosPadroes))

  for (const m of todosMatches) {
    const v1 = parseInt(m[1], 10)
    const v2 = parseInt(m[2], 10)

    // Se é uma data óbvia (dia > 12 e mês <= 12, ex: 28/10), salva como data de compra
    if (v1 > 12 && v1 <= 31 && v2 >= 1 && v2 <= 12 && !dataCompraDetectada) {
      dataCompraDetectada = `${anoReferencia}-${String(v2).padStart(2, '0')}-${String(v1).padStart(2, '0')}`
      continue
    }

    // Se é um parcelamento válido (v1 <= v2 e v2 <= 48 e v1 >= 1), e ainda não achamos parcela
    if (!trechoParcela && v1 >= 1 && v2 >= 2 && v2 <= 48 && v1 <= v2) {
      parcelaAtual = v1
      totalParcelas = v2
      trechoParcela = m[0]
      continue
    }

    // Se já achamos parcela e sobrou um "XX/YY", pode ser data
    if (trechoParcela && !dataCompraDetectada && v1 >= 1 && v1 <= 31 && v2 >= 1 && v2 <= 12) {
      dataCompraDetectada = `${anoReferencia}-${String(v2).padStart(2, '0')}-${String(v1).padStart(2, '0')}`
    }
  }

  // 4. Se encontrou parcelamento, limpa a descrição base
  let descricaoBase = texto
  if (trechoParcela) {
    descricaoBase = descricaoBase.replace(trechoParcela, ' ')
  }

  // Limpa também qualquer data detectada da descrição base
  if (dataCompraDetectada) {
    const [, mesStr, diaStr] = dataCompraDetectada.split('-')
    const regexDataLimpar = new RegExp(`\\b0?${parseInt(diaStr, 10)}\\/0?${parseInt(mesStr, 10)}(?:\\/\\d{2,4})?\\b`, 'g')
    descricaoBase = descricaoBase.replace(regexDataLimpar, ' ')
  }

  descricaoBase = descricaoBase
    .replace(/\b(?:PARC\.?|PARCELA)\b/gi, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    parcelado: !!trechoParcela,
    parcelaAtual,
    totalParcelas,
    descricaoBase: descricaoBase || texto,
    dataCompraDetectada,
  }
}

/**
 * Calcula a data de vencimento da fatura e o mês de referência correspondente
 * para uma compra no cartão com base no dia de fechamento e dia de vencimento.
 */
export function calcularDatasCartao(
  dataCompra: string,
  diaFechamento: number,
  diaVencimento: number,
  offsetMeses: number = 0,
): DatasCartao {
  let { mes, ano } = mesVencimentoFatura(dataCompra, diaFechamento, diaVencimento)

  for (let i = 0; i < offsetMeses; i++) {
    ;({ mes, ano } = proximoMes(mes, ano))
  }

  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimoDia)
  const dataVencimentoParcela = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const mesAnoFormatado = `${NOMES_MESES_ABREV[mes - 1]}/${ano}`

  return {
    dataCompra,
    dataVencimentoParcela,
    mesReferencia: mes,
    anoReferencia: ano,
    mesAnoFormatado,
  }
}

/**
 * Gera as parcelas futuras para uma compra parcelada importada pelo OFX.
 * Se a compra importada for a parcela 2/6, esta função gera APENAS as parcelas
 * 3/6, 4/6, 5/6 e 6/6 (nunca recria a 1/6 ou a parcela atual).
 */
export function gerarParcelasFuturasOfx({
  parcelaAtual,
  totalParcelas,
  valorParcela,
  dataCompra,
  dataVencimentoParcelaAtual,
  descricaoBase,
  categoriaId,
  observacao,
  cartaoId,
  grupoParcelaId,
  fitidOrigem,
}: {
  parcelaAtual: number
  totalParcelas: number
  valorParcela: number
  dataCompra: string
  dataVencimentoParcelaAtual: string
  descricaoBase: string
  categoriaId?: string
  observacao?: string
  cartaoId: string
  grupoParcelaId: string
  fitidOrigem?: string
}): ParcelaFuturaGerada[] {
  if (parcelaAtual >= totalParcelas || totalParcelas < 2) {
    return []
  }

  const parcelasFuturas: ParcelaFuturaGerada[] = []

  // Extrai ano e mês da data de vencimento da parcela atual
  const [anoAtualStr, mesAtualStr, diaAtualStr] = dataVencimentoParcelaAtual.split('-')
  let anoVenc = parseInt(anoAtualStr, 10)
  let mesVenc = parseInt(mesAtualStr, 10)
  const diaVenc = parseInt(diaAtualStr, 10)

  for (let p = parcelaAtual + 1; p <= totalParcelas; p++) {
    // Avança 1 mês a cada iteração
    const prox = proximoMes(mesVenc, anoVenc)
    mesVenc = prox.mes
    anoVenc = prox.ano

    const ultimoDia = new Date(anoVenc, mesVenc, 0).getDate()
    const diaAjustado = Math.min(diaVenc, ultimoDia)
    const dataVenc = `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaAjustado).padStart(2, '0')}`

    const tags = ['parcela_futura']
    if (fitidOrigem) {
      tags.push(`origem_ofx:${fitidOrigem}`)
    }

    parcelasFuturas.push({
      parcela_atual: p,
      total_parcelas: totalParcelas,
      valor: valorParcela,
      data: dataCompra, // Data original da compra é preservada
      data_vencimento_parcela: dataVenc,
      descricao: `${descricaoBase} (${p}/${totalParcelas})`,
      categoria_id: categoriaId,
      observacao: observacao || undefined,
      cartao_id: cartaoId,
      grupo_parcela_id: grupoParcelaId,
      efetivado: false, // Prevista (não efetivada ainda)
      tipo: 'despesa',
      tags,
    })
  }

  return parcelasFuturas
}

/**
 * Verifica se uma transação do OFX corresponde a uma parcela futura previamente
 * cadastrada no sistema (evitando gerar duplicidade e permitindo vincular/atualizar).
 */
export function identificarParcelaCorrespondente(
  transacao: TransacaoOfx,
  lancamentos: Lancamento[],
  cartaoId: string,
): Lancamento | null {
  const info = extrairDadosParcelamentoDescricao(transacao.descricao)
  const valorCentavos = Math.round(transacao.valor * 100)

  // 1. Se identificamos número de parcela (ex: 3/6), procuramos exatamente essa parcela no cartão
  if (info.parcelado && info.parcelaAtual && info.totalParcelas) {
    const matchExato = lancamentos.find(l => {
      if (l.cartao_id !== cartaoId) return false
      if (l.tipo !== transacao.tipo) return false
      if (Math.round(l.valor * 100) !== valorCentavos) return false
      if (!l.parcelado) return false
      if (l.parcela_atual !== info.parcelaAtual) return false
      if (l.total_parcelas !== info.totalParcelas) return false

      // Verifica se a descrição é semelhante
      const descL = (l.descricao || '').toLowerCase()
      const descBase = info.descricaoBase.toLowerCase()
      return descL.includes(descBase) || descBase.includes(descL)
    })

    if (matchExato) return matchExato
  }

  // 2. Se não encontrou por parcela exata, verifica se há um lançamento de cartão
  // não efetivado (previsto) com mesmo valor, mesmo mês de vencimento e descrição parecida
  const [anoTxStr, mesTxStr] = transacao.data.split('-')
  const anoTx = parseInt(anoTxStr, 10)
  const mesTx = parseInt(mesTxStr, 10)

  const matchPrevisto = lancamentos.find(l => {
    if (l.cartao_id !== cartaoId) return false
    if (l.tipo !== transacao.tipo) return false
    if (Math.round(l.valor * 100) !== valorCentavos) return false
    if (l.efetivado) return false // Somente lançamentos pendentes/previstos

    if (l.data_vencimento_parcela) {
      const [anoLStr, mesLStr] = l.data_vencimento_parcela.split('-')
      const anoL = parseInt(anoLStr, 10)
      const mesL = parseInt(mesLStr, 10)
      const diffMeses = Math.abs((anoTx * 12 + mesTx) - (anoL * 12 + mesL))
      if (diffMeses > 1) return false
    }

    const descL = (l.descricao || '').toLowerCase()
    const descTx = transacao.descricao.toLowerCase()
    return descL.includes(descTx) || descTx.includes(descL)
  })

  return matchPrevisto ?? null
}
