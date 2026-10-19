import { describe, it, expect } from 'vitest'
import {
  tagPagamentoFatura,
  isPagamentoFatura,
  dividirValorParcelas,
  mesFaturaCartao,
  mesVencimentoFatura,
  mesEfetivo,
  dataParcelaCartao,
  dataParcelaBanco,
  avancarMeses,
  dataVencimentoParcela,
  addFrequencia,
  contarRecorrencias,
  gerarParcelas,
  gerarRecorrencias,
} from './lancamentos'
import type { Lancamento } from './supabase'

type LancamentoInput = Omit<Lancamento, 'id' | 'user_id' | 'created_at' | 'updated_at'>

/** Base mínima válida de um lançamento, para não repetir os mesmos campos em todo teste. */
function baseLancamento(overrides: Partial<LancamentoInput> = {}): LancamentoInput {
  return {
    tipo: 'despesa',
    descricao: 'Compra teste',
    valor: 100,
    data: '2026-06-10',
    parcelado: false,
    recorrente: false,
    efetivado: false,
    ...overrides,
  }
}

describe('tagPagamentoFatura / isPagamentoFatura', () => {
  it('gera a tag no formato esperado', () => {
    expect(tagPagamentoFatura('cartao-1', 7, 2026)).toBe('fatura:cartao-1:2026:7')
  })

  it('identifica um lançamento marcado como pagamento de fatura', () => {
    expect(isPagamentoFatura(['fatura:cartao-1:2026:7'])).toBe(true)
  })

  it('não confunde outras tags com pagamento de fatura', () => {
    expect(isPagamentoFatura(['mercado', 'essencial'])).toBe(false)
  })

  it('lida com tags ausentes sem quebrar', () => {
    expect(isPagamentoFatura(undefined)).toBe(false)
    expect(isPagamentoFatura(null)).toBe(false)
    expect(isPagamentoFatura([])).toBe(false)
  })
})

describe('dividirValorParcelas', () => {
  it('divide um valor exato igualmente', () => {
    expect(dividirValorParcelas(300, 3)).toEqual([100, 100, 100])
  })

  it('joga o resto de centavos pra última parcela', () => {
    const parcelas = dividirValorParcelas(100, 3)
    expect(parcelas).toEqual([33.33, 33.33, 33.34])
    // a soma das parcelas tem que bater exatamente com o total (sem perder nem sobrar centavo)
    const soma = parcelas.reduce((a, b) => a + b, 0)
    expect(Math.round(soma * 100)).toBe(10000)
  })

  it('retorna o valor cheio quando só há 1 parcela', () => {
    expect(dividirValorParcelas(250, 1)).toEqual([250])
  })
})

describe('mesFaturaCartao', () => {
  it('compra antes do fechamento entra na fatura do mesmo mês', () => {
    // fechamento dia 25, compra dia 10 → fatura de junho
    expect(mesFaturaCartao('2026-06-10', 25)).toEqual({ mes: 6, ano: 2026 })
  })

  it('compra depois do fechamento entra na fatura do mês seguinte', () => {
    // fechamento dia 25, compra dia 28 → fatura de julho
    expect(mesFaturaCartao('2026-06-28', 25)).toEqual({ mes: 7, ano: 2026 })
  })

  it('compra exatamente no dia do fechamento ainda entra no mês da compra', () => {
    expect(mesFaturaCartao('2026-06-25', 25)).toEqual({ mes: 6, ano: 2026 })
  })

  it('vira o ano corretamente quando a fatura rola de dezembro pra janeiro', () => {
    expect(mesFaturaCartao('2026-12-28', 25)).toEqual({ mes: 1, ano: 2027 })
  })
})

describe('mesVencimentoFatura — regra real de fechamento x vencimento', () => {
  // Exemplo 1 do usuário: fechamento dia 28, pagamento dia 10.
  // Vencimento < Fechamento → paga sempre no mês SEGUINTE ao fechamento.
  // Compras entre 29/07 e 28/08 formam a fatura que fecha em agosto e vence em 10/09.
  it('exemplo 1: fechamento 28 / pagamento 10 → compra logo após o fechamento anterior', () => {
    expect(mesVencimentoFatura('2026-07-29', 28, 10)).toEqual({ mes: 9, ano: 2026 })
  })

  it('exemplo 1: fechamento 28 / pagamento 10 → compra no próprio dia do fechamento', () => {
    expect(mesVencimentoFatura('2026-08-28', 28, 10)).toEqual({ mes: 9, ano: 2026 })
  })

  // Exemplo 2 do usuário: fechamento dia 06, pagamento dia 15.
  // Vencimento > Fechamento → paga no MESMO mês do fechamento.
  // Compras entre 07/07 e 06/08 formam a fatura que fecha em agosto e vence em 15/08.
  it('exemplo 2: fechamento 06 / pagamento 15 → compra logo após o fechamento anterior', () => {
    expect(mesVencimentoFatura('2026-07-07', 6, 15)).toEqual({ mes: 8, ano: 2026 })
  })

  it('exemplo 2: fechamento 06 / pagamento 15 → compra no próprio dia do fechamento', () => {
    expect(mesVencimentoFatura('2026-08-06', 6, 15)).toEqual({ mes: 8, ano: 2026 })
  })

  it('vira o ano corretamente quando o vencimento empurra de dezembro pra janeiro', () => {
    // fechamento 28, pagamento 10 → compra em dezembro fecha em dezembro, vence em janeiro do ano seguinte
    expect(mesVencimentoFatura('2026-12-10', 28, 10)).toEqual({ mes: 1, ano: 2027 })
  })
})

describe('mesEfetivo — o coração da correção "mês da compra vs. mês de pagamento"', () => {
  it('usa data_vencimento_parcela quando disponível, ignorando a data da compra', () => {
    // Comprou dia 10/06, mas a fatura só será paga em 10/07 → tem que contar em julho
    const resultado = mesEfetivo({
      data: '2026-06-10',
      cartao_id: 'cartao-1',
      data_vencimento_parcela: '2026-07-10',
    })
    expect(resultado).toEqual({ mes: 7, ano: 2026 })
  })

  it('cai para o cálculo por dia de fechamento quando não há data_vencimento_parcela salva', () => {
    const resultado = mesEfetivo(
      { data: '2026-06-28', cartao_id: 'cartao-1', data_vencimento_parcela: null },
      25 // dia de fechamento
    )
    expect(resultado).toEqual({ mes: 7, ano: 2026 })
  })

  it('usa a data normal para lançamentos que não são de cartão', () => {
    const resultado = mesEfetivo({ data: '2026-06-10', cartao_id: null })
    expect(resultado).toEqual({ mes: 6, ano: 2026 })
  })

  it('usa a data normal mesmo com cartao_id se não há vencimento nem fallback de fechamento', () => {
    const resultado = mesEfetivo({ data: '2026-06-10', cartao_id: 'cartao-1' })
    expect(resultado).toEqual({ mes: 6, ano: 2026 })
  })
})

describe('avancarMeses', () => {
  it('avança um número simples de meses mantendo o dia', () => {
    expect(avancarMeses('2026-03-15', 2)).toBe('2026-05-15')
  })

  it('vira o ano quando ultrapassa dezembro', () => {
    expect(avancarMeses('2026-11-10', 3)).toBe('2027-02-10')
  })

  it('ajusta pro último dia do mês quando o dia não existe no mês de destino', () => {
    // 31 de janeiro + 1 mês: fevereiro não tem dia 31
    expect(avancarMeses('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('retorna a mesma data quando avança 0 meses', () => {
    expect(avancarMeses('2026-06-10', 0)).toBe('2026-06-10')
  })
})

describe('addFrequencia', () => {
  it.each([
    ['diario', '2026-06-11'],
    ['semanal', '2026-06-17'],
    ['quinzenal', '2026-06-25'],
    ['mensal', '2026-07-10'],
    ['bimestral', '2026-08-10'],
    ['trimestral', '2026-09-10'],
    ['semestral', '2026-12-10'],
    ['anual', '2027-06-10'],
  ] as const)('%s avança corretamente a partir de 2026-06-10', (frequencia, esperado) => {
    expect(addFrequencia('2026-06-10', frequencia)).toBe(esperado)
  })
})

describe('contarRecorrencias', () => {
  it('gera 12 ocorrências para uma recorrência mensal em 1 ano', () => {
    expect(contarRecorrencias('2026-01-15', 'mensal')).toBe(12)
  })

  it('respeita o teto de 36 ocorrências mesmo quando a frequência semanal geraria mais que isso em 1 ano', () => {
    // Nota: o app limita a 36 ocorrências por vez (MAX_RECORRENCIAS) — para frequências
    // mais curtas que mensal, isso é menos que 1 ano completo. É esse teto que faz a
    // extensão automática de recorrências (estenderRecorrencias) ser necessária.
    expect(contarRecorrencias('2026-01-01', 'semanal')).toBe(36)
  })
})

describe('dataParcelaCartao', () => {
  it('parcela 0 cai na fatura da própria compra', () => {
    expect(dataParcelaCartao('2026-06-10', 25, 0)).toBe('2026-06-25')
  })

  it('parcela seguinte avança um mês', () => {
    expect(dataParcelaCartao('2026-06-10', 25, 1)).toBe('2026-07-25')
  })

  it('ajusta o dia de fechamento para o último dia de fevereiro', () => {
    expect(dataParcelaCartao('2026-01-10', 31, 1)).toBe('2026-02-28')
  })
})

describe('dataParcelaBanco', () => {
  it('avança meses corridos a partir da data da compra', () => {
    expect(dataParcelaBanco('2026-06-10', 0)).toBe('2026-06-10')
    expect(dataParcelaBanco('2026-06-10', 2)).toBe('2026-08-10')
  })
})

describe('dataVencimentoParcela', () => {
  it('empurra o vencimento pro mês seguinte ao fechamento quando o dia de pagamento é menor que o de fechamento', () => {
    // fechamento dia 25, pagamento dia 5: compra dia 10/06 fecha a fatura de junho,
    // que só será paga em julho (dia 5 < dia 25)
    expect(dataVencimentoParcela('2026-06-10', 25, 5, 0)).toBe('2026-07-05')
  })

  it('avança o vencimento das parcelas seguintes mês a mês', () => {
    expect(dataVencimentoParcela('2026-06-10', 25, 5, 1)).toBe('2026-08-05')
  })
})

describe('gerarParcelas', () => {
  it('não parcela quando parcelado é false', () => {
    const l = baseLancamento({ parcelado: false })
    expect(gerarParcelas(l)).toEqual([l])
  })

  it('divide corretamente uma compra parcelada no cartão, com vencimento automático', () => {
    const l = baseLancamento({
      valor: 300,
      data: '2026-06-10',
      cartao_id: 'cartao-1',
      parcelado: true,
      total_parcelas: 3,
    })
    const parcelas = gerarParcelas(l, 25, 5) // fechamento dia 25, vencimento dia 5

    expect(parcelas).toHaveLength(3)
    expect(parcelas.map(p => p.valor)).toEqual([100, 100, 100])
    expect(parcelas.map(p => p.parcela_atual)).toEqual([1, 2, 3])
    // todas as parcelas mantêm a data da compra original (o que muda é o vencimento)
    expect(parcelas.every(p => p.data === '2026-06-10')).toBe(true)
    expect(parcelas.map(p => p.data_vencimento_parcela)).toEqual([
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
    ])
    // todas as parcelas pertencem ao mesmo grupo
    const grupos = new Set(parcelas.map(p => p.grupo_parcela_id))
    expect(grupos.size).toBe(1)
  })

  it('quando o vencimento é maior que o fechamento, a fatura vence no mesmo mês do fechamento', () => {
    // fechamento dia 6, vencimento dia 15 (exemplo 2): compra dia 10/07 fecha a fatura
    // de agosto (compra após o fechamento de julho), que vence ainda em agosto
    const l = baseLancamento({
      valor: 150,
      data: '2026-07-10',
      cartao_id: 'cartao-1',
      parcelado: true,
      total_parcelas: 2,
    })
    const parcelas = gerarParcelas(l, 6, 15)
    expect(parcelas.map(p => p.data_vencimento_parcela)).toEqual(['2026-08-15', '2026-09-15'])
  })

  it('respeita um vencimento definido manualmente pelo usuário', () => {
    const l = baseLancamento({
      valor: 200,
      data: '2026-06-10',
      cartao_id: 'cartao-1',
      parcelado: true,
      total_parcelas: 2,
      data_vencimento_parcela: '2026-07-15', // usuário editou manualmente
    })
    const parcelas = gerarParcelas(l, 25, 5)
    expect(parcelas.map(p => p.data_vencimento_parcela)).toEqual(['2026-07-15', '2026-08-15'])
  })

  it('parcela em conta bancária avança a própria data da compra mês a mês (sem vencimento de fatura)', () => {
    const l = baseLancamento({
      valor: 200,
      data: '2026-06-10',
      banco_id: 'banco-1',
      parcelado: true,
      total_parcelas: 2,
    })
    const parcelas = gerarParcelas(l)
    expect(parcelas.map(p => p.data)).toEqual(['2026-06-10', '2026-07-10'])
    expect(parcelas.every(p => p.data_vencimento_parcela === undefined)).toBe(true)
  })
})

describe('gerarRecorrencias', () => {
  it('não gera recorrência quando recorrente é false', () => {
    const l = baseLancamento({ recorrente: false })
    expect(gerarRecorrencias(l)).toEqual([l])
  })

  it('gera 12 ocorrências mensais preservando os demais dados do lançamento', () => {
    const l = baseLancamento({
      data: '2026-01-15',
      recorrente: true,
      frequencia: 'mensal',
      descricao: 'Assinatura streaming',
    })
    const ocorrencias = gerarRecorrencias(l)
    expect(ocorrencias).toHaveLength(12)
    expect(ocorrencias[0].data).toBe('2026-01-15')
    expect(ocorrencias[1].data).toBe('2026-02-15')
    expect(ocorrencias.every(o => o.descricao === 'Assinatura streaming')).toBe(true)
    expect(ocorrencias.every(o => o.recorrente === true)).toBe(true)
  })
})
