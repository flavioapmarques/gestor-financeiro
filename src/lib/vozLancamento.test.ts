import { describe, it, expect } from 'vitest'
import {
  interpretarComandoVoz,
  converterPalavrasParaNumero,
  extrairValor,
  extrairParcelamento,
  extrairEstabelecimento,
} from './vozLancamento'
import type { Banco, Cartao, Categoria } from './supabase'

const MOCK_BANCOS: Banco[] = [
  {
    id: 'banco-bb',
    user_id: 'user-1',
    nome: 'Banco do Brasil',
    instituicao: 'Banco do Brasil',
    tipo: 'corrente',
    saldo_inicial: 1000,
    data_saldo_inicial: '2026-01-01',
    cor: '#f5c842',
    icone: 'landmark',
    ativo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'banco-inter',
    user_id: 'user-1',
    nome: 'Inter',
    instituicao: 'Inter',
    tipo: 'corrente',
    saldo_inicial: 500,
    data_saldo_inicial: '2026-01-01',
    cor: '#ff7a00',
    icone: 'landmark',
    ativo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

const MOCK_CARTOES: Cartao[] = [
  {
    id: 'cartao-inter',
    user_id: 'user-1',
    nome: 'Inter Black',
    banco: 'Inter',
    bandeira: 'mastercard',
    limite: 5000,
    dia_fechamento: 5,
    dia_vencimento: 12,
    cor: '#ff7a00',
    ativo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
  {
    id: 'cartao-nubank',
    user_id: 'user-1',
    nome: 'Nubank',
    banco: 'Nubank',
    bandeira: 'mastercard',
    limite: 3000,
    dia_fechamento: 1,
    dia_vencimento: 8,
    cor: '#8a05be',
    ativo: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  },
]

const MOCK_CATEGORIAS: Categoria[] = [
  { id: 'cat-alimentacao', user_id: 'user-1', nome: 'Alimentação', tipo: 'despesa', cor: '#22d4a0', icone: 'shopping-cart', created_at: '2026-01-01' },
  { id: 'cat-transporte', user_id: 'user-1', nome: 'Transporte', tipo: 'despesa', cor: '#f5c842', icone: 'car', created_at: '2026-01-01' },
  { id: 'cat-saude', user_id: 'user-1', nome: 'Saúde', tipo: 'despesa', cor: '#ff6b7a', icone: 'heart', created_at: '2026-01-01' },
  { id: 'cat-esportes', user_id: 'user-1', nome: 'Esportes', tipo: 'despesa', cor: '#3d5afe', icone: 'activity', created_at: '2026-01-01' },
  { id: 'cat-lazer', user_id: 'user-1', nome: 'Lazer', tipo: 'despesa', cor: '#b06ef5', icone: 'tv', created_at: '2026-01-01' },
  { id: 'cat-moradia', user_id: 'user-1', nome: 'Moradia', tipo: 'despesa', cor: '#6c8ef5', icone: 'home', created_at: '2026-01-01' },
]

describe('Módulo de Lançamento por Voz com IA (vozLancamento)', () => {
  it('converte números por extenso corretamente', () => {
    expect(converterPalavrasParaNumero('vinte')).toBe(20)
    expect(converterPalavrasParaNumero('trinta e cinco')).toBe(35)
    expect(converterPalavrasParaNumero('duzentos')).toBe(200)
    expect(converterPalavrasParaNumero('cinquenta e oito')).toBe(58)
    expect(converterPalavrasParaNumero('cento e cinquenta')).toBe(150)
    expect(converterPalavrasParaNumero('dois mil e quinhentos')).toBe(2500)
  })

  it('extrai valor numérico e por extenso com centavos', () => {
    expect(extrairValor('vinte reais').valor).toBe(20)
    expect(extrairValor('trinta e cinco reais').valor).toBe(35)
    expect(extrairValor('duzentos reais').valor).toBe(200)
    expect(extrairValor('58 reais').valor).toBe(58)
    expect(extrairValor('R$ 35,50').valor).toBe(35.5)
    expect(extrairValor('vinte reais e cinquenta centavos').valor).toBe(20.5)
  })

  it('extrai parcelamento em dígitos e por extenso', () => {
    expect(extrairParcelamento('parcelado em duas vezes')).toEqual({ parcelado: true, totalParcelas: 2 })
    expect(extrairParcelamento('em 3x')).toEqual({ parcelado: true, totalParcelas: 3 })
    expect(extrairParcelamento('parcelado em 5 parcelas')).toEqual({ parcelado: true, totalParcelas: 5 })
    expect(extrairParcelamento('compra à vista')).toEqual({ parcelado: false })
  })

  it('Exemplo 1: Lançar despesa no Banco do Brasil de vinte reais para o estabelecimento Tal', () => {
    const texto = 'Lançar despesa no Banco do Brasil de vinte reais para o estabelecimento Tal.'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.tipo).toBe('despesa')
    expect(resultado.valor).toBe(20)
    expect(resultado.bancoId).toBe('banco-bb')
    expect(resultado.formaPagamento).toBe('banco')
    expect(resultado.descricao).toBe('Tal')
    expect(resultado.parcelado).toBe(false)
  })

  it('Exemplo 2: Lançar despesa no cartão de crédito do banco Inter de trinta e cinco reais na Sorveteria Firenze', () => {
    const texto = 'Lançar despesa no cartão de crédito do banco Inter de trinta e cinco reais na Sorveteria Firenze.'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.tipo).toBe('despesa')
    expect(resultado.valor).toBe(35)
    expect(resultado.formaPagamento).toBe('cartao')
    expect(resultado.cartaoId).toBe('cartao-inter')
    expect(resultado.descricao).toBe('Sorveteria Firenze')
    expect(resultado.categoriaId).toBe('cat-alimentacao')
    expect(resultado.parcelado).toBe(false)
  })

  it('Exemplo 3: Lançar despesa no cartão de crédito do banco Inter de duzentos reais parcelado em duas vezes na Decathlon', () => {
    const texto = 'Lançar despesa no cartão de crédito do banco Inter de duzentos reais parcelado em duas vezes na Decathlon.'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.tipo).toBe('despesa')
    expect(resultado.valor).toBe(200)
    expect(resultado.formaPagamento).toBe('cartao')
    expect(resultado.cartaoId).toBe('cartao-inter')
    expect(resultado.descricao).toBe('Decathlon')
    expect(resultado.categoriaId).toBe('cat-esportes')
    expect(resultado.parcelado).toBe(true)
    expect(resultado.totalParcelas).toBe(2)
  })

  it('Exemplo 4: Gastei cinquenta e oito reais no supermercado no cartão Nubank', () => {
    const texto = 'Gastei cinquenta e oito reais no supermercado no cartão Nubank.'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.tipo).toBe('despesa')
    expect(resultado.valor).toBe(58)
    expect(resultado.formaPagamento).toBe('cartao')
    expect(resultado.cartaoId).toBe('cartao-nubank')
    expect(resultado.descricao).toBe('Supermercado')
    expect(resultado.categoriaId).toBe('cat-alimentacao')
  })

  it('Identifica despesa de transporte no posto de gasolina', () => {
    const texto = 'Paguei 120 reais no posto shell no débito Banco do Brasil'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.valor).toBe(120)
    expect(resultado.bancoId).toBe('banco-bb')
    expect(resultado.formaPagamento).toBe('banco')
    expect(resultado.categoriaId).toBe('cat-transporte')
  })

  it('Identifica saúde na farmácia com centavos', () => {
    const texto = 'Lançar despesa de quarenta e cinco reais e noventa centavos na farmácia Drogasil no cartão Nubank'
    const resultado = interpretarComandoVoz(texto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.valor).toBe(45.9)
    expect(resultado.formaPagamento).toBe('cartao')
    expect(resultado.cartaoId).toBe('cartao-nubank')
    expect(resultado.categoriaId).toBe('cat-saude')
  })

  it('Alerta quando informações estão incompletas ou ausentes', () => {
    const textoIncompleto = 'Gastei na padaria'
    const resultado = interpretarComandoVoz(textoIncompleto, MOCK_BANCOS, MOCK_CARTOES, MOCK_CATEGORIAS)

    expect(resultado.valor).toBe(0)
    expect(resultado.confianca.valor).toBe(false)
    expect(resultado.avisos.some(a => a.includes('valor'))).toBe(true)
  })
})
