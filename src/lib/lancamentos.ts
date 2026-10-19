import type { Frequencia, Lancamento } from './supabase'
import { proximoMes } from './utils'

export function tagPagamentoFatura(cartaoId: string, mes: number, ano: number): string {
  return `fatura:${cartaoId}:${ano}:${mes}`
}

export function isPagamentoFatura(tags?: string[] | null): boolean {
  return tags?.some(t => t.startsWith('fatura:')) ?? false
}

/** Divide valor total em parcelas iguais (última parcela absorve centavos). */
export function dividirValorParcelas(valorTotal: number, totalParcelas: number): number[] {
  if (totalParcelas <= 1) return [valorTotal]
  const centavos = Math.round(valorTotal * 100)
  const base = Math.floor(centavos / totalParcelas)
  const resto = centavos - base * totalParcelas
  return Array.from({ length: totalParcelas }, (_, i) => {
    const c = base + (i === totalParcelas - 1 ? resto : 0)
    return c / 100
  })
}

/** Mês/ano da fatura em que a compra cai, conforme dia de fechamento. */
export function mesFaturaCartao(dataCompra: string, diaFechamento: number): { mes: number; ano: number } {
  const d = new Date(dataCompra + 'T12:00:00')
  let mes = d.getMonth() + 1
  let ano = d.getFullYear()
  if (d.getDate() > diaFechamento) {
    const next = proximoMes(mes, ano)
    mes = next.mes
    ano = next.ano
  }
  return { mes, ano }
}

/**
 * Mês/ano em que um lançamento realmente "pesa no bolso":
 * - Compra no cartão: conta no mês em que a fatura será/foi paga (data_vencimento_parcela),
 *   não no mês em que a compra foi feita. Se não houver essa data salva (dados antigos),
 *   cai para o cálculo pelo dia de fechamento do cartão.
 * - Qualquer outro lançamento (conta, receita, transferência): conta na própria data.
 */
export function mesEfetivo(
  l: { data: string; cartao_id?: string | null; data_vencimento_parcela?: string | null },
  diaFechamentoFallback?: number,
  diaVencimentoFallback?: number
): { mes: number; ano: number } {
  if (l.cartao_id) {
    if (l.data_vencimento_parcela) {
      const [ano, mes] = l.data_vencimento_parcela.split('-').map(Number)
      return { mes, ano }
    }
    if (diaFechamentoFallback != null && diaVencimentoFallback != null) {
      return mesVencimentoFatura(l.data, diaFechamentoFallback, diaVencimentoFallback)
    }
    if (diaFechamentoFallback != null) return mesFaturaCartao(l.data, diaFechamentoFallback)
  }
  const [ano, mes] = l.data.split('-').map(Number)
  return { mes, ano }
}


/**
 * Mês/ano em que a fatura de uma compra será efetivamente paga.
 *
 * Regra: o mês de fechamento é dado por mesFaturaCartao. A partir dali, se o dia de
 * vencimento é MENOR que o dia de fechamento, o pagamento cai no mês seguinte ao
 * fechamento (ex.: fecha dia 28, paga dia 10 → fatura fecha em agosto, paga em setembro).
 * Se o dia de vencimento é MAIOR que o dia de fechamento, o pagamento cai no mesmo mês
 * do fechamento (ex.: fecha dia 6, paga dia 15 → fatura fecha em agosto, paga em agosto).
 */
export function mesVencimentoFatura(
  dataCompra: string,
  diaFechamento: number,
  diaVencimento: number
): { mes: number; ano: number } {
  let { mes, ano } = mesFaturaCartao(dataCompra, diaFechamento)
  if (diaVencimento < diaFechamento) {
    ;({ mes, ano } = proximoMes(mes, ano))
  }
  return { mes, ano }
}

export function dataParcelaCartao(
  dataCompra: string,
  diaFechamento: number,
  indiceParcela: number,
): string {
  let { mes, ano } = mesFaturaCartao(dataCompra, diaFechamento)
  for (let i = 0; i < indiceParcela; i++) {
    ;({ mes, ano } = proximoMes(mes, ano))
  }
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaFechamento, ultimoDia)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Data de lançamento para parcela N (0-based) em conta bancária (meses corridos). */
export function dataParcelaBanco(dataCompra: string, indiceParcela: number): string {
  const d = new Date(dataCompra + 'T12:00:00')
  d.setMonth(d.getMonth() + indiceParcela)
  return d.toISOString().split('T')[0]
}

export function addFrequencia(data: string, frequencia: Frequencia): string {
  const d = new Date(data + 'T12:00:00')
  switch (frequencia) {
    case 'diario':
      d.setDate(d.getDate() + 1)
      break
    case 'semanal':
      d.setDate(d.getDate() + 7)
      break
    case 'quinzenal':
      d.setDate(d.getDate() + 15)
      break
    case 'mensal':
      d.setMonth(d.getMonth() + 1)
      break
    case 'bimestral':
      d.setMonth(d.getMonth() + 2)
      break
    case 'trimestral':
      d.setMonth(d.getMonth() + 3)
      break
    case 'semestral':
      d.setMonth(d.getMonth() + 6)
      break
    case 'anual':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d.toISOString().split('T')[0]
}

const MAX_RECORRENCIAS = 36

/** Quantidade de ocorrências a gerar (até 1 ano ou limite). */
export function contarRecorrencias(dataInicio: string, frequencia: Frequencia): number {
  const fim = new Date(dataInicio + 'T12:00:00')
  fim.setFullYear(fim.getFullYear() + 1)
  let count = 0
  let atual = dataInicio
  while (count < MAX_RECORRENCIAS) {
    count++
    const next = addFrequencia(atual, frequencia)
    if (new Date(next + 'T12:00:00') >= fim) break
    atual = next
  }
  return count
}

type LancamentoInput = Omit<Lancamento, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export function gerarParcelas(
  lancamento: LancamentoInput,
  diaFechamentoCartao?: number,
  diaVencimentoCartao?: number,
): LancamentoInput[] {
  const total = lancamento.total_parcelas ?? 1
  if (!lancamento.parcelado || total <= 1) return [lancamento]

  const valores = dividirValorParcelas(lancamento.valor, total)
  const grupoId = crypto.randomUUID()
  const usaCartao = !!lancamento.cartao_id && diaFechamentoCartao != null

  // Se o usuário informou um vencimento manualmente no formulário,
  // ele vira a base da parcela 1 — as demais avançam mês a mês a partir dele.
  const vencimentoManual = lancamento.data_vencimento_parcela ?? null

  return valores.map((valor, i) => {
    const dataLancamento = usaCartao
      ? lancamento.data  // data da compra permanece sempre a mesma
      : dataParcelaBanco(lancamento.data, i)

    let vencimento: string | undefined
    if (usaCartao) {
      if (vencimentoManual) {
        // Usuário escolheu o vencimento: avança N meses a partir dele
        vencimento = avancarMeses(vencimentoManual, i)
      } else {
        // Cálculo automático pelo dia de vencimento do cartão
        vencimento = dataVencimentoParcela(
          lancamento.data,
          diaFechamentoCartao!,
          diaVencimentoCartao ?? diaFechamentoCartao!,
          i,
        )
      }
    }

    return {
      ...lancamento,
      valor,
      parcela_atual: i + 1,
      total_parcelas: total,
      grupo_parcela_id: grupoId,
      data: dataLancamento,
      data_vencimento_parcela: vencimento,
    }
  })
}

/**
 * Avança uma data YYYY-MM-DD por N meses, mantendo o mesmo dia
 * (ajustado para o último dia do mês quando necessário).
 */
export function avancarMeses(data: string, meses: number): string {
  if (meses === 0) return data
  const [ano, mes, dia] = data.split('-').map(Number)
  let novoAno = ano
  let novoMes = mes + meses
  while (novoMes > 12) { novoMes -= 12; novoAno++ }
  const ultimoDia = new Date(novoAno, novoMes, 0).getDate()
  const novoDia = Math.min(dia, ultimoDia)
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${String(novoDia).padStart(2, '0')}`
}

/**
 * Calcula a data de vencimento da parcela N (0-based) de uma compra no cartão.
 *
 * Regra:
 *  1. Descobre em qual fatura a compra cai (baseado no dia de fechamento)
 *  2. Para a parcela 0 → vencimento dessa fatura
 *  3. Para parcela 1 → vencimento do mês seguinte, etc.
 */
export function dataVencimentoParcela(
  dataCompra: string,
  diaFechamento: number,
  diaVencimento: number,
  indiceParcela: number,
): string {
  // Mês em que essa fatura de fato será paga (já considerando a regra de virada de mês)
  let { mes, ano } = mesVencimentoFatura(dataCompra, diaFechamento, diaVencimento)

  // Avança N meses para a parcela correta
  for (let i = 0; i < indiceParcela; i++) {
    ;({ mes, ano } = proximoMes(mes, ano))
  }

  // Dia de vencimento ajustado para o último dia do mês se necessário
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimoDia)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export function gerarRecorrencias(lancamento: LancamentoInput): LancamentoInput[] {
  if (!lancamento.recorrente || !lancamento.frequencia) return [lancamento]

  const qtd = contarRecorrencias(lancamento.data, lancamento.frequencia)
  const ocorrencias: LancamentoInput[] = []
  let dataAtual = lancamento.data

  for (let i = 0; i < qtd; i++) {
    ocorrencias.push({
      ...lancamento,
      data: dataAtual,
      recorrente: true,
    })
    if (i < qtd - 1) dataAtual = addFrequencia(dataAtual, lancamento.frequencia!)
  }

  return ocorrencias
}
