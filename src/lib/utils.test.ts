import { describe, it, expect } from 'vitest'
import { mesAnterior, subtrairMeses } from './utils'

describe('mesAnterior', () => {
  it('volta um mês dentro do mesmo ano', () => {
    expect(mesAnterior(7, 2026)).toEqual({ mes: 6, ano: 2026 })
  })

  it('vira o ano ao voltar de janeiro', () => {
    expect(mesAnterior(1, 2026)).toEqual({ mes: 12, ano: 2025 })
  })
})

describe('subtrairMeses — a correção do bug de "meses duplicados" no gráfico', () => {
  it('subtrai meses dentro do mesmo ano', () => {
    expect(subtrairMeses(2026, 7, 3)).toEqual({ ano: 2026, mes: 4 })
  })

  it('vira o ano corretamente ao subtrair além de janeiro', () => {
    expect(subtrairMeses(2026, 2, 5)).toEqual({ ano: 2025, mes: 9 })
  })

  it('não sofre overflow em dias 29/30/31 — o bug real que causava meses duplicados', () => {
    // O bug original usava `new Date(); d.setMonth(d.getMonth() - n)`. Como o Date criado
    // com `new Date()` mantém o DIA de hoje, se hoje for dia 31 (ex.: 31/05) e o mês de
    // destino tiver menos dias (ex.: fevereiro), o JS "estoura" pra março — dois meses
    // do gráfico acabavam com o mesmo rótulo. subtrairMeses trabalha só com ano/mês,
    // nunca com o dia, então não tem esse problema.
    //
    // Simulando "hoje = 31 de maio de 2026", pedindo os últimos 6 meses (maio → dezembro anterior):
    const hoje = { ano: 2026, mes: 5 } // maio
    const janela = Array.from({ length: 6 }, (_, i) => subtrairMeses(hoje.ano, hoje.mes, 5 - i))
    expect(janela).toEqual([
      { ano: 2025, mes: 12 },
      { ano: 2026, mes: 1 },
      { ano: 2026, mes: 2 }, // fevereiro — o mês que "sumia"/duplicava no bug antigo
      { ano: 2026, mes: 3 },
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 5 },
    ])
    // Nenhum mês duplicado na janela
    const chaves = janela.map(j => `${j.ano}-${j.mes}`)
    expect(new Set(chaves).size).toBe(6)
  })

  it('não sofre overflow em ano bissexto (29 de fevereiro)', () => {
    // 2028 é bissexto; subtrair 12 meses de fevereiro/2028 não deve estourar
    expect(subtrairMeses(2028, 2, 12)).toEqual({ ano: 2027, mes: 2 })
  })
})
