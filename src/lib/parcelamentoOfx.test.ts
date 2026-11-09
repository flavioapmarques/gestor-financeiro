import { describe, expect, it } from 'vitest'
import {
  extrairDadosParcelamentoDescricao,
  calcularDatasCartao,
  gerarParcelasFuturasOfx,
  identificarParcelaCorrespondente,
} from './parcelamentoOfx'
import type { Lancamento } from './supabase'
import type { TransacaoOfx } from './ofx'

describe('parcelamentoOfx - extrairDadosParcelamentoDescricao', () => {
  it('identifica formato clássico LOJA 02/06', () => {
    const res = extrairDadosParcelamentoDescricao('DECATHLON 02/06')
    expect(res.parcelado).toBe(true)
    expect(res.parcelaAtual).toBe(2)
    expect(res.totalParcelas).toBe(6)
    expect(res.descricaoBase).toBe('DECATHLON')
  })

  it('identifica formato com PARC. 2/6 LOJA', () => {
    const res = extrairDadosParcelamentoDescricao('PARC. 2/6 DECATHLON')
    expect(res.parcelado).toBe(true)
    expect(res.parcelaAtual).toBe(2)
    expect(res.totalParcelas).toBe(6)
    expect(res.descricaoBase).toBe('DECATHLON')
  })

  it('identifica formato entre parênteses LOJA (03/10)', () => {
    const res = extrairDadosParcelamentoDescricao('MAGAZINE LUIZA (03/10)')
    expect(res.parcelado).toBe(true)
    expect(res.parcelaAtual).toBe(3)
    expect(res.totalParcelas).toBe(10)
    expect(res.descricaoBase).toBe('MAGAZINE LUIZA')
  })

  it('identifica formato com "DE" (PARCELA 01 DE 05)', () => {
    const res = extrairDadosParcelamentoDescricao('POSTO IPIRANGA PARCELA 01 DE 05')
    expect(res.parcelado).toBe(true)
    expect(res.parcelaAtual).toBe(1)
    expect(res.totalParcelas).toBe(5)
    expect(res.descricaoBase).toBe('POSTO IPIRANGA')
  })

  it('identifica data de compra embutida junto com o parcelamento', () => {
    const res = extrairDadosParcelamentoDescricao('COMPRA 28/10 DECATHLON 02/06', 2026)
    expect(res.parcelado).toBe(true)
    expect(res.parcelaAtual).toBe(2)
    expect(res.totalParcelas).toBe(6)
    expect(res.dataCompraDetectada).toBe('2026-10-28')
    expect(res.descricaoBase).toBe('COMPRA DECATHLON')
  })

  it('não confunde data simples sem parcelamento', () => {
    const res = extrairDadosParcelamentoDescricao('POSTO IPIRANGA 15/06', 2026)
    // 15/06 não é parcela porque 15 > 06
    expect(res.parcelado).toBe(false)
    expect(res.dataCompraDetectada).toBe('2026-06-15')
  })

  it('retorna parcelado: false para compras à vista', () => {
    const res = extrairDadosParcelamentoDescricao('UBER *TRIP SAO PAULO')
    expect(res.parcelado).toBe(false)
    expect(res.descricaoBase).toBe('UBER *TRIP SAO PAULO')
  })
})

describe('parcelamentoOfx - calcularDatasCartao', () => {
  it('calcula data de cobrança e mês de referência corretamente', () => {
    // Compra 28/10, fechamento 25, vencimento 05:
    // Fechamento da fatura em 25/11, vencimento 05 < fechamento 25 -> Vence em Dezembro (05/12/2026)
    const res = calcularDatasCartao('2026-10-28', 25, 5)
    expect(res.dataCompra).toBe('2026-10-28')
    expect(res.dataVencimentoParcela).toBe('2026-12-05')
    expect(res.mesReferencia).toBe(12)
    expect(res.anoReferencia).toBe(2026)
    expect(res.mesAnoFormatado).toBe('Dez/2026')
  })

  it('calcula fatura no mesmo mês quando dia de vencimento é maior que fechamento', () => {
    // Compra 10/05, fechamento 05, vencimento 15:
    // Fechamento cai em Junho (05/06), vencimento 15 > 05 -> Vence no mesmo mês (15/06/2026)
    const res = calcularDatasCartao('2026-05-10', 5, 15)
    expect(res.dataVencimentoParcela).toBe('2026-06-15')
    expect(res.mesReferencia).toBe(6)
  })
})

describe('parcelamentoOfx - gerarParcelasFuturasOfx', () => {
  it('gera apenas as parcelas restantes (3/6, 4/6, 5/6, 6/6) ao importar 2/6', () => {
    const parcelas = gerarParcelasFuturasOfx({
      parcelaAtual: 2,
      totalParcelas: 6,
      valorParcela: 200,
      dataCompra: '2026-10-28',
      dataVencimentoParcelaAtual: '2026-12-05',
      descricaoBase: 'Decathlon',
      categoriaId: 'cat-esportes',
      observacao: 'Bicicleta',
      cartaoId: 'card-1',
      grupoParcelaId: 'grupo-123',
      fitidOrigem: 'fitid-ofx-001',
    })

    // Deve ter gerado exatamente 4 parcelas (3, 4, 5, 6)
    expect(parcelas).toHaveLength(4)
    expect(parcelas.map(p => p.parcela_atual)).toEqual([3, 4, 5, 6])

    // Todas devem ter a data da compra original preservada
    expect(parcelas.every(p => p.data === '2026-10-28')).toBe(true)

    // Todas devem ter status não efetivado (previstas)
    expect(parcelas.every(p => p.efetivado === false)).toBe(true)

    // O grupo deve ser o mesmo
    expect(parcelas.every(p => p.grupo_parcela_id === 'grupo-123')).toBe(true)

    // Vencimentos devem avançar mês a mês
    expect(parcelas[0].data_vencimento_parcela).toBe('2027-01-05') // Parcela 3
    expect(parcelas[1].data_vencimento_parcela).toBe('2027-02-05') // Parcela 4
    expect(parcelas[2].data_vencimento_parcela).toBe('2027-03-05') // Parcela 5
    expect(parcelas[3].data_vencimento_parcela).toBe('2027-04-05') // Parcela 6

    // Tags de identificação e origem
    expect(parcelas[0].tags).toContain('parcela_futura')
    expect(parcelas[0].tags).toContain('origem_ofx:fitid-ofx-001')
  })

  it('não gera parcelas futuras se a parcela atual já for a última', () => {
    const parcelas = gerarParcelasFuturasOfx({
      parcelaAtual: 6,
      totalParcelas: 6,
      valorParcela: 100,
      dataCompra: '2026-10-28',
      dataVencimentoParcelaAtual: '2026-12-05',
      descricaoBase: 'Decathlon',
      cartaoId: 'card-1',
      grupoParcelaId: 'grupo-123',
    })
    expect(parcelas).toHaveLength(0)
  })
})

describe('parcelamentoOfx - identificarParcelaCorrespondente', () => {
  const lancamentosExistentes: Lancamento[] = [
    {
      id: 'lanc-parc-3',
      user_id: 'u1',
      tipo: 'despesa',
      descricao: 'Decathlon (3/6)',
      valor: 200,
      data: '2026-10-28',
      data_vencimento_parcela: '2027-01-05',
      cartao_id: 'card-1',
      parcelado: true,
      parcela_atual: 3,
      total_parcelas: 6,
      grupo_parcela_id: 'grupo-123',
      efetivado: false,
      recorrente: false,
      created_at: '',
      updated_at: '',
    },
  ]

  it('encontra parcela correspondente pelo número de parcela e cartão', () => {
    const txOfx: TransacaoOfx = {
      fitid: 'ofx-jan-003',
      data: '2027-01-02',
      valor: 200,
      tipo: 'despesa',
      descricao: 'DECATHLON 03/06',
    }

    const encontrado = identificarParcelaCorrespondente(txOfx, lancamentosExistentes, 'card-1')
    expect(encontrado).not.toBeNull()
    expect(encontrado?.id).toBe('lanc-parc-3')
    expect(encontrado?.parcela_atual).toBe(3)
  })

  it('não vincula se o cartão for diferente', () => {
    const txOfx: TransacaoOfx = {
      fitid: 'ofx-jan-003',
      data: '2027-01-02',
      valor: 200,
      tipo: 'despesa',
      descricao: 'DECATHLON 03/06',
    }

    const encontrado = identificarParcelaCorrespondente(txOfx, lancamentosExistentes, 'outro-card')
    expect(encontrado).toBeNull()
  })
})
