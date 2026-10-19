import { describe, expect, it } from 'vitest'
import { gerarResumoMensal } from './alertas'

describe('gerarResumoMensal', () => {
  it('calcula saldo líquido, economia e taxa com base nos lançamentos do mês', () => {
    const resumo = gerarResumoMensal({
      lancamentosMes: [
        { id: '1', user_id: 'u1', tipo: 'receita', descricao: 'Salário', valor: 5000, data: '2026-09-01', parcelado: false, recorrente: false, efetivado: true, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u1', tipo: 'despesa', descricao: 'Mercado', valor: 1800, data: '2026-09-05', parcelado: false, recorrente: false, efetivado: true, created_at: '', updated_at: '' },
        { id: '3', user_id: 'u1', tipo: 'despesa', descricao: 'Aluguel', valor: 1200, data: '2026-09-10', parcelado: false, recorrente: false, efetivado: true, created_at: '', updated_at: '' },
      ],
      cartoes: [],
      metas: [],
      orcamentos: [],
    })

    expect(resumo.receita).toBe(5000)
    expect(resumo.despesa).toBe(3000)
    expect(resumo.saldoLiquido).toBe(2000)
    expect(resumo.economia).toBe(2000)
    expect(resumo.taxaEconomia).toBe(0.4)
    expect(resumo.alerta).toBe('saudavel')
  })

  it('identifica risco quando os gastos ultrapassam a receita', () => {
    const resumo = gerarResumoMensal({
      lancamentosMes: [
        { id: '1', user_id: 'u1', tipo: 'receita', descricao: 'Salário', valor: 3000, data: '2026-09-01', parcelado: false, recorrente: false, efetivado: true, created_at: '', updated_at: '' },
        { id: '2', user_id: 'u1', tipo: 'despesa', descricao: 'Cartão', valor: 3500, data: '2026-09-06', parcelado: false, recorrente: false, efetivado: true, created_at: '', updated_at: '' },
      ],
      cartoes: [],
      metas: [],
      orcamentos: [],
    })

    expect(resumo.saldoLiquido).toBe(-500)
    expect(resumo.alerta).toBe('atencao')
  })
})
