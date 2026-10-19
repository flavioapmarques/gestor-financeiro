import type { Lancamento } from './supabase'
import type { TransacaoOfx } from './ofx'

export type StatusConciliacao = 'ja_lancado' | 'possivel' | 'nao_lancado' | 'duplicidade'

export interface ConfigConciliacaoOfx {
  toleranciaDias: number
  pesoValor: number
  pesoDataExata: number
  pesoDataTolerada: number
  pesoDescricao: number
}

export const CONFIG_CONCILIACAO_OFX: ConfigConciliacaoOfx = {
  toleranciaDias: 3,
  pesoValor: 50,
  pesoDataExata: 30,
  pesoDataTolerada: 20,
  pesoDescricao: 20,
}

export interface CandidatoConciliacao {
  lancamento: Lancamento
  score: number
  diferencaDias: number
}

export interface ResultadoConciliacao {
  transacao: TransacaoOfx
  status: StatusConciliacao
  score: number
  candidato: CandidatoConciliacao | null
  candidatos: CandidatoConciliacao[]
}

const PALAVRAS_BANCARIAS = new Set([
  'compra', 'pagamento', 'debito', 'credito', 'cartao', 'pix', 'transferencia',
  'ted', 'doc', 'tarifa', 'tar', 'saque', 'envio', 'recebimento', 'via',
])

export function normalizarDescricaoOfx(descricao: string): string {
  return descricao
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokensDescricao(descricao: string): Set<string> {
  return new Set(
    normalizarDescricaoOfx(descricao)
      .split(/\s+/)
      .filter(token => token.length >= 3 && !PALAVRAS_BANCARIAS.has(token)),
  )
}

function similaridadeDescricao(a: string, b: string): number {
  const normalizadaA = normalizarDescricaoOfx(a)
  const normalizadaB = normalizarDescricaoOfx(b)
  if (!normalizadaA || !normalizadaB) return 0
  if (normalizadaA === normalizadaB || normalizadaA.includes(normalizadaB) || normalizadaB.includes(normalizadaA)) return 1

  const tokensA = tokensDescricao(a)
  const tokensB = tokensDescricao(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  const compartilhados = [...tokensA].filter(token => tokensB.has(token)).length
  return compartilhados / new Set([...tokensA, ...tokensB]).size
}

function diferencaDias(dataA: string, dataB: string): number {
  const a = Date.parse(`${dataA}T12:00:00Z`)
  const b = Date.parse(`${dataB}T12:00:00Z`)
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000))
}

function temFitid(transacao: TransacaoOfx, lancamento: Lancamento): boolean {
  return lancamento.tags?.some(tag => tag === `ofx:${transacao.fitid}`) ?? false
}

function fingerprint(transacao: TransacaoOfx): string {
  return `${transacao.data}|${transacao.tipo}|${Math.round(transacao.valor * 100)}|${normalizarDescricaoOfx(transacao.descricao)}`
}

function scoreCandidato(
  transacao: TransacaoOfx,
  lancamento: Lancamento,
  config: ConfigConciliacaoOfx,
): CandidatoConciliacao | null {
  if (transacao.tipo !== lancamento.tipo) return null
  if (Math.round(transacao.valor * 100) !== Math.round(lancamento.valor * 100)) return null

  const dias = diferencaDias(transacao.data, lancamento.data)
  if (dias > config.toleranciaDias) return null

  let score = config.pesoValor
  score += dias === 0 ? config.pesoDataExata : config.pesoDataTolerada
  if (similaridadeDescricao(transacao.descricao, lancamento.descricao) >= 0.35) score += config.pesoDescricao

  return { lancamento, score, diferencaDias: dias }
}

export function conciliarTransacaoOfx(
  transacao: TransacaoOfx,
  lancamentos: Lancamento[],
  config: ConfigConciliacaoOfx = CONFIG_CONCILIACAO_OFX,
): ResultadoConciliacao {
  const porFitid = lancamentos.find(lancamento => temFitid(transacao, lancamento))
  if (porFitid) {
    const candidato = { lancamento: porFitid, score: config.pesoValor + config.pesoDataExata + config.pesoDescricao, diferencaDias: 0 }
    return { transacao, status: 'ja_lancado', score: 100, candidato, candidatos: [candidato] }
  }

  const candidatos = lancamentos
    .map(lancamento => scoreCandidato(transacao, lancamento, config))
    .filter((candidato): candidato is CandidatoConciliacao => candidato !== null)
    .sort((a, b) => b.score - a.score)

  const melhor = candidatos[0] ?? null
  const mesmaChave = melhor != null && candidatos.filter(candidato => (
    candidato.score === melhor.score
    && candidato.lancamento.data === melhor.lancamento.data
    && Math.round(candidato.lancamento.valor * 100) === Math.round(melhor.lancamento.valor * 100)
    && similaridadeDescricao(candidato.lancamento.descricao, melhor.lancamento.descricao) >= 0.8
  )).length > 1

  if (mesmaChave) {
    return { transacao, status: 'duplicidade', score: melhor.score, candidato: melhor, candidatos }
  }
  if (melhor && melhor.score >= 100) return { transacao, status: 'ja_lancado', score: melhor.score, candidato: melhor, candidatos }
  if (melhor && melhor.score >= 70) return { transacao, status: 'possivel', score: melhor.score, candidato: melhor, candidatos }
  return { transacao, status: 'nao_lancado', score: melhor?.score ?? 0, candidato: melhor, candidatos }
}

export function conciliarExtratoOfx(
  transacoes: TransacaoOfx[],
  lancamentos: Lancamento[],
  config: ConfigConciliacaoOfx = CONFIG_CONCILIACAO_OFX,
): ResultadoConciliacao[] {
  return transacoes.map(transacao => conciliarTransacaoOfx(transacao, lancamentos, config))
}
