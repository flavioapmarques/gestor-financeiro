/**
 * Parser de arquivos OFX 1.x (o formato "SGML" antigo, usado pela grande maioria dos
 * bancos brasileiros — diferente do OFX 2.x, que é XML de verdade). Nesse formato as
 * tags de valor costumam vir SEM fechamento (ex.: `<TRNAMT>-150.00` sem `</TRNAMT>`),
 * então não dá pra usar um parser de XML — é preciso ler por regex, campo a campo.
 */

export interface TransacaoOfx {
  /** ID único da transação dentro do extrato (FITID) — usado para not duplicar em reimportações. */
  fitid: string
  data: string // YYYY-MM-DD
  valor: number // sempre positivo — o sinal vira o campo `tipo`
  tipo: 'receita' | 'despesa'
  descricao: string
}

export interface ExtratoOfx {
  transacoes: TransacaoOfx[]
  /** Tipo de conta detectado no arquivo, quando identificável. */
  origem: 'conta' | 'cartao' | 'desconhecida'
  /** Últimos dígitos da conta/cartão, quando presentes no arquivo (só pra ajudar o usuário a conferir). */
  contaIdentificada?: string
}

function extrairTag(bloco: string, tag: string): string | undefined {
  // Tag pode ou não estar fechada; o valor vai até a próxima tag ou quebra de linha
  const regex = new RegExp(`<${tag}>\\s*([^\\r\\n<]*)`, 'i')
  const match = bloco.match(regex)
  return match ? match[1].trim() : undefined
}

function parseDataOfx(raw: string): string | null {
  // Formatos possíveis: 20260615 | 20260615120000 | 20260615120000[-3:BRT] | 20260615120000.000[-3:BRT]
  const digitos = raw.match(/^(\d{8})/)
  if (!digitos) return null
  const s = digitos[1]
  const ano = s.slice(0, 4)
  const mes = s.slice(4, 6)
  const dia = s.slice(6, 8)
  return `${ano}-${mes}-${dia}`
}

function parseValorOfx(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '')
  if (!s) return null
  // Formato brasileiro incomum em OFX (ex.: "1.234,56") — normaliza pra ponto decimal
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const valor = parseFloat(s)
  return Number.isFinite(valor) ? valor : null
}

/** Extrai o conteúdo de todos os blocos <TAG>...</TAG>, tolerando SGML malformado. */
function extrairBlocos(conteudo: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi')
  const blocos: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(conteudo)) !== null) {
    blocos.push(match[1])
  }
  return blocos
}

/**
 * Lê o conteúdo de um arquivo .ofx (já como texto) e devolve a lista de transações
 * encontradas, prontas para virar lançamentos no app.
 */
export function parseOfx(conteudo: string): ExtratoOfx {
  const blocosTransacao = extrairBlocos(conteudo, 'STMTTRN')

  const transacoes: TransacaoOfx[] = []
  for (const bloco of blocosTransacao) {
    const dataRaw = extrairTag(bloco, 'DTPOSTED')
    const valorRaw = extrairTag(bloco, 'TRNAMT')
    const fitid = extrairTag(bloco, 'FITID')
    const memo = extrairTag(bloco, 'MEMO')
    const name = extrairTag(bloco, 'NAME')

    if (!dataRaw || !valorRaw) continue // transação sem data ou valor não é aproveitável

    const data = parseDataOfx(dataRaw)
    const valorComSinal = parseValorOfx(valorRaw)
    if (!data || valorComSinal === null || valorComSinal === 0) continue

    const descricao = (memo || name || 'Transação importada').trim()

    transacoes.push({
      fitid: fitid || `${data}-${valorComSinal}-${descricao}`, // fallback se o banco não informar FITID
      data,
      valor: Math.abs(valorComSinal),
      tipo: valorComSinal < 0 ? 'despesa' : 'receita',
      descricao,
    })
  }

  // Detecta se é extrato de conta corrente ou de cartão de crédito
  let origem: ExtratoOfx['origem'] = 'desconhecida'
  if (/<CCACCTFROM>/i.test(conteudo)) origem = 'cartao'
  else if (/<BANKACCTFROM>/i.test(conteudo)) origem = 'conta'

  const acctId = extrairTag(conteudo, 'ACCTID')
  const contaIdentificada = acctId ? acctId.slice(-4) : undefined

  return { transacoes, origem, contaIdentificada }
}
