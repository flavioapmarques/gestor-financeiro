import { describe, expect, it } from 'vitest'
import {
  conciliarTransacaoOfx,
  isStatusImportadoOuDuplicado,
  filtrarConciliacoesVisiveis,
  calcularResumoConciliacao,
  type StatusConciliacao,
  type ResultadoConciliacao,
} from './conciliacaoOfx'
import type { Lancamento } from './supabase'
import type { TransacaoOfx } from './ofx'

function transacao(overrides: Partial<TransacaoOfx> = {}): TransacaoOfx {
  return {
    fitid: 'ofx-1',
    data: '2026-06-10',
    valor: 150,
    tipo: 'despesa',
    descricao: 'Supermercado Central',
    ...overrides,
  }
}

function lancamento(overrides: Partial<Lancamento> = {}): Lancamento {
  return {
    id: 'l-1',
    user_id: 'u-1',
    tipo: 'despesa',
    descricao: 'Supermercado Central',
    valor: 150,
    data: '2026-06-10',
    parcelado: false,
    recorrente: false,
    efetivado: true,
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
    ...overrides,
  }
}

describe('conciliação OFX', () => {
  it('marca como já lançado quando encontra o mesmo FITID', () => {
    const entrada = transacao({ fitid: 'ofx-1' })
    const atual = [lancamento({ tags: ['ofx:ofx-1'] })]
    const resultado = conciliarTransacaoOfx(entrada, atual)
    expect(resultado.status).toBe('ja_lancado')
    expect(resultado.score).toBe(100)
    expect(resultado.candidato?.lancamento.id).toBe('l-1')
  })

  it('marca como já lançado mesmo com descrição e data diferentes se o FITID coincidir', () => {
    const entrada = transacao({ fitid: 'ofx-1', data: '2026-06-10', descricao: 'DOC ELET' })
    const resultado = conciliarTransacaoOfx(
      entrada,
      [lancamento({ descricao: 'Lançamento manual', tags: ['ofx:ofx-1'] })],
    )
    expect(resultado.status).toBe('ja_lancado')
  })

  it('marca como possível quando data e valor coincidem com boa descrição', () => {
    const entrada = transacao({ fitid: 'ofx-99', descricao: 'SUPERMERCADO CENTRAL 10/06' })
    const resultado = conciliarTransacaoOfx(
      entrada,
      [lancamento({ id: 'l-alvo', descricao: 'Supermercado Central', valor: 150, data: '2026-06-11' })],
    )
    expect(resultado.status).toBe('possivel')
    expect(resultado.score).toBe(90)
    expect(resultado.candidato?.lancamento.id).toBe('l-alvo')
  })

  it('marca como não lançado quando não há nenhum candidato aceitável', () => {
    const entrada = transacao({ fitid: 'ofx-novo', valor: 420 })
    const resultado = conciliarTransacaoOfx(entrada, [lancamento({ valor: 150 })])
    expect(resultado.status).toBe('nao_lancado')
    expect(resultado.candidato).toBeNull()
  })

  it('marca como duplicidade quando há múltiplos lançamentos idênticos', () => {
    const entrada = transacao({ fitid: 'ofx-duplicado' })
    const resultado = conciliarTransacaoOfx(entrada, [
      lancamento({ id: 'l-a' }),
      lancamento({ id: 'l-b' }),
    ])
    expect(resultado.status).toBe('duplicidade')
    expect(resultado.candidatos).toHaveLength(2)
  })

  it('identifica e casa com parcela prevista não efetivada existente', () => {
    const entrada = transacao({
      fitid: 'ofx-decathlon-3',
      descricao: 'DECATHLON 03/06',
      valor: 200,
      data: '2027-01-02',
    })
    const lancamentos = [
      lancamento({
        id: 'l-parc-3',
        descricao: 'Decathlon (3/6)',
        valor: 200,
        data: '2026-10-28', // Data original da compra
        data_vencimento_parcela: '2027-01-05', // Data da fatura
        parcelado: true,
        parcela_atual: 3,
        total_parcelas: 6,
        efetivado: false, // Prevista
      }),
    ]

    const resultado = conciliarTransacaoOfx(entrada, lancamentos)
    expect(resultado.status).toBe('possivel')
    expect(resultado.score).toBe(100)
    expect(resultado.candidato?.isParcelaCorrespondente).toBe(true)
    expect(resultado.candidato?.lancamento.id).toBe('l-parc-3')
  })

  it('marca como já lançado quando parcela correspondente já foi efetivada', () => {
    const entrada = transacao({
      fitid: 'ofx-decathlon-3',
      descricao: 'DECATHLON 03/06',
      valor: 200,
      data: '2027-01-02',
    })
    const lancamentos = [
      lancamento({
        id: 'l-parc-3',
        descricao: 'Decathlon (3/6)',
        valor: 200,
        data: '2026-10-28',
        data_vencimento_parcela: '2027-01-05',
        parcelado: true,
        parcela_atual: 3,
        total_parcelas: 6,
        efetivado: true, // Já efetivado em fatura anterior
      }),
    ]

    const resultado = conciliarTransacaoOfx(entrada, lancamentos)
    expect(resultado.status).toBe('ja_lancado')
  })

  it('identifica corretamente status importado ou duplicado', () => {
    expect(isStatusImportadoOuDuplicado('ja_lancado')).toBe(true)
    expect(isStatusImportadoOuDuplicado('duplicidade')).toBe(true)
    expect(isStatusImportadoOuDuplicado('nao_lancado')).toBe(false)
    expect(isStatusImportadoOuDuplicado('possivel')).toBe(false)
  })

  it('filtra conciliações visíveis quando opção ocultar estiver ativa', () => {
    const lista: ResultadoConciliacao[] = [
      { transacao: transacao({ fitid: '1' }), status: 'ja_lancado', score: 100, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '2' }), status: 'nao_lancado', score: 0, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '3' }), status: 'possivel', score: 70, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '4' }), status: 'duplicidade', score: 100, candidato: null, candidatos: [] },
    ]

    expect(filtrarConciliacoesVisiveis(lista, false)).toHaveLength(4)

    const visiveis = filtrarConciliacoesVisiveis(lista, true)
    expect(visiveis).toHaveLength(2)
    expect(visiveis.map(v => v.transacao.fitid)).toEqual(['2', '3'])
  })

  it('calcula o resumo de quantidades corretamente', () => {
    const lista: ResultadoConciliacao[] = [
      { transacao: transacao({ fitid: '1' }), status: 'ja_lancado', score: 100, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '2' }), status: 'nao_lancado', score: 0, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '3' }), status: 'nao_lancado', score: 0, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '4' }), status: 'possivel', score: 70, candidato: null, candidatos: [] },
      { transacao: transacao({ fitid: '5' }), status: 'duplicidade', score: 100, candidato: null, candidatos: [] },
    ]

    const resumo = calcularResumoConciliacao(lista)
    expect(resumo.total).toBe(5)
    expect(resumo.jaLancados).toBe(1)
    expect(resumo.duplicidades).toBe(1)
    expect(resumo.possiveis).toBe(1)
    expect(resumo.naoLancados).toBe(2)
    expect(resumo.totalImportadosOuDuplicados).toBe(2)
  })
})
