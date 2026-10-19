import { describe, expect, it } from 'vitest'
import { conciliarTransacaoOfx, type StatusConciliacao } from './conciliacaoOfx'
import type { Lancamento } from './supabase'
import type { TransacaoOfx } from './ofx'

function lancamento(overrides: Partial<Lancamento> = {}): Lancamento {
  return {
    id: 'l1',
    user_id: 'u1',
    tipo: 'despesa',
    descricao: 'Supermercado XYZ',
    valor: 150,
    data: '2026-09-05',
    parcelado: false,
    recorrente: false,
    efetivado: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function transacao(overrides: Partial<TransacaoOfx> = {}): TransacaoOfx {
  return {
    fitid: 'ofx-1',
    data: '2026-09-05',
    valor: 150,
    tipo: 'despesa',
    descricao: 'COMPRA CARTAO SUPERMERCADO XYZ',
    ...overrides,
  }
}

describe('conciliação OFX', () => {
  it.each<[string, StatusConciliacao, number]>([
    ['correspondência exata', 'ja_lancado', 100],
    ['mesmo valor e data tolerada com descrição parecida', 'possivel', 90],
    ['sem candidato compatível', 'nao_lancado', 0],
  ])('%s', (_nome, status, score) => {
    const atual = status === 'nao_lancado'
      ? [lancamento({ valor: 80, data: '2026-09-20', descricao: 'Farmácia' })]
      : [lancamento()]
    const entrada = status === 'possivel'
      ? transacao({ data: '2026-09-07', descricao: 'SUPERMERCADO XYZ' })
      : status === 'nao_lancado'
        ? transacao({ valor: 200, descricao: 'Posto ABC' })
        : transacao()

    const resultado = conciliarTransacaoOfx(entrada, atual)
    expect(resultado.status).toBe(status)
    expect(resultado.score).toBe(score)
  })

  it('considera FITID já salvo como já lançado, mesmo com descrição diferente', () => {
    const resultado = conciliarTransacaoOfx(
      transacao({ descricao: 'Texto novo' }),
      [lancamento({ descricao: 'Lançamento manual', tags: ['ofx:ofx-1'] })],
    )

    expect(resultado.status).toBe('ja_lancado')
    expect(resultado.candidato?.lancamento.id).toBe('l1')
  })

  it('marca duplicidade quando existem dois candidatos equivalentes', () => {
    const resultado = conciliarTransacaoOfx(
      transacao(),
      [
        lancamento({ id: 'l1' }),
        lancamento({ id: 'l2' }),
      ],
    )

    expect(resultado.status).toBe('duplicidade')
    expect(resultado.candidatos).toHaveLength(2)
  })
})
