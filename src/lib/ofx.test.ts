import { describe, it, expect } from 'vitest'
import { parseOfx } from './ofx'

const OFX_CONTA_EXEMPLO = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260630120000
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>001
<ACCTID>00012345-6
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260601
<DTEND>20260630
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260605120000[-3:BRT]
<TRNAMT>-150.00
<FITID>202606050001
<MEMO>Compra em loja XYZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260610000000[-3:BRT]
<TRNAMT>2500.00
<FITID>202606100001
<MEMO>Salario Empresa ABC
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260615
<TRNAMT>-42.90
<FITID>202606150001
<NAME>Posto Ferrari
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>2307.10
<DTASOF>20260630120000
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`

const OFX_CARTAO_EXEMPLO = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<CCSTMTRS>
<CURDEF>BRL
<CCACCTFROM>
<ACCTID>1234567890123456
</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260703
<TRNAMT>-89.90
<FITID>CC0001
<MEMO>Restaurante Bom Sabor
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>
`

describe('parseOfx — extrato de conta corrente', () => {
  const resultado = parseOfx(OFX_CONTA_EXEMPLO)

  it('encontra todas as transações do extrato', () => {
    expect(resultado.transacoes).toHaveLength(3)
  })

  it('identifica corretamente uma despesa (valor negativo) com hora no DTPOSTED', () => {
    const t = resultado.transacoes[0]
    expect(t.data).toBe('2026-06-05')
    expect(t.valor).toBe(150)
    expect(t.tipo).toBe('despesa')
    expect(t.descricao).toBe('Compra em loja XYZ')
    expect(t.fitid).toBe('202606050001')
  })

  it('identifica corretamente uma receita (valor positivo)', () => {
    const t = resultado.transacoes[1]
    expect(t.data).toBe('2026-06-10')
    expect(t.valor).toBe(2500)
    expect(t.tipo).toBe('receita')
    expect(t.descricao).toBe('Salario Empresa ABC')
  })

  it('usa NAME como descrição quando não há MEMO, e lida com data sem hora', () => {
    const t = resultado.transacoes[2]
    expect(t.data).toBe('2026-06-15')
    expect(t.descricao).toBe('Posto Ferrari')
  })

  it('detecta que é um extrato de conta corrente e os últimos dígitos da conta', () => {
    expect(resultado.origem).toBe('conta')
    expect(resultado.contaIdentificada).toBe('45-6')
  })
})

describe('parseOfx — extrato de cartão de crédito', () => {
  const resultado = parseOfx(OFX_CARTAO_EXEMPLO)

  it('encontra a transação do cartão', () => {
    expect(resultado.transacoes).toHaveLength(1)
    expect(resultado.transacoes[0].descricao).toBe('Restaurante Bom Sabor')
    expect(resultado.transacoes[0].valor).toBe(89.9)
    expect(resultado.transacoes[0].tipo).toBe('despesa')
  })

  it('detecta que é um extrato de cartão de crédito', () => {
    expect(resultado.origem).toBe('cartao')
    expect(resultado.contaIdentificada).toBe('3456')
  })
})

describe('parseOfx — casos extremos', () => {
  it('retorna lista vazia para um arquivo sem transações', () => {
    const resultado = parseOfx('<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>')
    expect(resultado.transacoes).toEqual([])
    expect(resultado.origem).toBe('desconhecida')
  })

  it('ignora transações sem data ou sem valor', () => {
    const ofx = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<FITID>SEMDATA001
<MEMO>Sem data nem valor
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701
<TRNAMT>-10.00
<FITID>VALIDA001
<MEMO>Essa é válida
</STMTTRN>
</OFX>`
    const resultado = parseOfx(ofx)
    expect(resultado.transacoes).toHaveLength(1)
    expect(resultado.transacoes[0].fitid).toBe('VALIDA001')
  })

  it('ignora transações de valor zero', () => {
    const ofx = `<OFX>
<STMTTRN>
<TRNTYPE>FEE
<DTPOSTED>20260701
<TRNAMT>0.00
<FITID>ZERO001
<MEMO>Tarifa zerada
</STMTTRN>
</OFX>`
    expect(parseOfx(ofx).transacoes).toHaveLength(0)
  })

  it('gera um fitid de fallback quando o banco não informa FITID', () => {
    const ofx = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701
<TRNAMT>-25.00
<MEMO>Sem FITID mesmo
</STMTTRN>
</OFX>`
    const resultado = parseOfx(ofx)
    expect(resultado.transacoes).toHaveLength(1)
    expect(resultado.transacoes[0].fitid).toBeTruthy()
  })

  it('normaliza valores em formato brasileiro raro (vírgula decimal)', () => {
    const ofx = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701
<TRNAMT>-1.234,56
<FITID>BR001
<MEMO>Valor com vírgula
</STMTTRN>
</OFX>`
    const resultado = parseOfx(ofx)
    expect(resultado.transacoes[0].valor).toBe(1234.56)
  })
})
