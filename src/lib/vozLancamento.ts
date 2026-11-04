import type { Banco, Cartao, Categoria } from './supabase'

export interface DadosLancamentoVoz {
  tipo: 'despesa' | 'receita'
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  formaPagamento: 'cartao' | 'banco' | 'indefinido'
  bancoId?: string
  cartaoId?: string
  categoriaId?: string
  categoriaNome?: string
  parcelado: boolean
  totalParcelas?: number
  observacao?: string
  confianca: {
    valor: boolean
    descricao: boolean
    contaOuCartao: boolean
    categoria: boolean
    parcelas: boolean
  }
  avisos: string[]
  textoOriginal: string
}

/** Remove acentos e converte para minúsculas para comparações flexíveis */
export function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// ── DICIONÁRIO DE NÚMEROS POR EXTENSO EM PORTUGUÊS ───────────
const UNIDADES: Record<string, number> = {
  zero: 0,
  um: 1, uma: 1,
  dois: 2, duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6, meia: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14, catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
}

const DEZENAS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
}

const CENTENAS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200, duzentas: 200,
  trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500,
  seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
}

/** Converte sequência de palavras de números em português para número */
export function converterPalavrasParaNumero(texto: string): number | null {
  const palavras = normalizarTexto(texto).split(/\s+/).filter(p => p !== 'e')
  if (palavras.length === 0) return null

  let total = 0
  let atual = 0
  let reconheceuAlgum = false

  for (let i = 0; i < palavras.length; i++) {
    const p = palavras[i]

    if (p === 'mil') {
      if (atual === 0) atual = 1
      total += atual * 1000
      atual = 0
      reconheceuAlgum = true
    } else if (CENTENAS[p] !== undefined) {
      atual += CENTENAS[p]
      reconheceuAlgum = true
    } else if (DEZENAS[p] !== undefined) {
      atual += DEZENAS[p]
      reconheceuAlgum = true
    } else if (UNIDADES[p] !== undefined) {
      atual += UNIDADES[p]
      reconheceuAlgum = true
    } else if (/^\d+$/.test(p)) {
      atual += parseInt(p, 10)
      reconheceuAlgum = true
    } else {
      if (reconheceuAlgum) break
    }
  }

  total += atual
  return reconheceuAlgum ? total : null
}

/** Extrai valor numérico (incluindo centavos e números por extenso) */
export function extrairValor(texto: string): { valor: number; confianca: boolean } {
  const norm = normalizarTexto(texto)

  // 1. Procurar centavos explícitos (ex: "X reais e cinquenta centavos", "X reais com 50 centavos")
  let centavos = 0
  let textoParaValor = norm
  const mCentavosComReais = norm.match(/(?:reais|real)\s+(?:e|com)\s+([a-z0-9\s]+?)\s*centavos\b/i)
  if (mCentavosComReais) {
    const txt = mCentavosComReais[1].trim()
    const numCent = /^\d+$/.test(txt) ? parseInt(txt, 10) : converterPalavrasParaNumero(txt)
    if (numCent !== null && numCent >= 0 && numCent < 100) {
      centavos = numCent / 100
      // Remove apenas a cauda de centavos mantendo a palavra reais intacta
      textoParaValor = textoParaValor.replace(/(reais|real)\s+(?:e|com)\s+[a-z0-9\s]+?\s*centavos\b/i, '$1')
    }
  } else {
    const mCentavosPuros = norm.match(/\b([a-z0-9\s]+?)\s*centavos\b/i)
    if (mCentavosPuros && !norm.includes('reais') && !norm.includes('real')) {
      const txt = mCentavosPuros[1].trim()
      const numCent = /^\d+$/.test(txt) ? parseInt(txt, 10) : converterPalavrasParaNumero(txt)
      if (numCent !== null && numCent > 0 && numCent < 100) {
        return { valor: numCent / 100, confianca: true }
      }
    }
  }

  // 2. Procurar dígitos com vírgula ou ponto (ex: "R$ 35,50", "35.50")
  const mDigitosComCentavos = textoParaValor.match(/(?:r\$\s*)?(\d+)[.,](\d{1,2})/i)
  if (mDigitosComCentavos) {
    const inteiro = parseInt(mDigitosComCentavos[1], 10)
    const frac = parseInt(mDigitosComCentavos[2].padEnd(2, '0').slice(0, 2), 10) / 100
    return { valor: Math.round((inteiro + frac) * 100) / 100, confianca: true }
  }

  // 3. Procurar dígitos inteiros com ou sem "reais" (ex: "58 reais", "r$ 200", "de 20")
  const mDigitos = textoParaValor.match(/(?:r\$\s*|de\s+|por\s+|gastei\s+)?(\d+)\s*(?:reais|real)?/i)
  if (mDigitos && parseInt(mDigitos[1], 10) > 0) {
    return { valor: Math.round((parseInt(mDigitos[1], 10) + centavos) * 100) / 100, confianca: true }
  }

  // 4. Procurar número por extenso antes de "reais" ou após verbos
  const mExtenso = textoParaValor.match(/(?:de|gastei|por|valor de|paguei)?\s*([a-z\s]+?)\s*(?:reais|real)\b/i)
  if (mExtenso) {
    const parteTexto = mExtenso[1].trim()
    const vExtenso = converterPalavrasParaNumero(parteTexto)
    if (vExtenso !== null && vExtenso > 0) {
      return { valor: Math.round((vExtenso + centavos) * 100) / 100, confianca: true }
    }
  }

  // 5. Tentar converter qualquer número por extenso solto
  const numGeral = converterPalavrasParaNumero(textoParaValor)
  if (numGeral !== null && numGeral > 0) {
    return { valor: Math.round((numGeral + centavos) * 100) / 100, confianca: true }
  }

  return { valor: 0, confianca: false }
}

/** Extrai parcelamento (ex: "parcelado em 2 vezes", "em 3x", "duas vezes") */
export function extrairParcelamento(texto: string): { parcelado: boolean; totalParcelas?: number } {
  const norm = normalizarTexto(texto)

  const padraoNum = /(?:parcelad[oa]\s+(?:em\s+)?|em\s+|dividir\s+em\s+)(\d{1,2})\s*(?:x|vezes|parcelas)/i
  const mNum = norm.match(padraoNum)
  if (mNum) {
    const p = parseInt(mNum[1], 10)
    if (p > 1) return { parcelado: true, totalParcelas: p }
  }

  const padraoExtenso = /(?:parcelad[oa]\s+(?:em\s+)?|em\s+|dividir\s+em\s+)(duas|tres|quatro|cinco|seis|sete|oito|nove|dez|doze)\s*(?:vezes|parcelas)/i
  const mExt = norm.match(padraoExtenso)
  if (mExt) {
    const p = UNIDADES[mExt[1]]
    if (p && p > 1) return { parcelado: true, totalParcelas: p }
  }

  const mX = norm.match(/\b(\d{1,2})x\b/i)
  if (mX) {
    const p = parseInt(mX[1], 10)
    if (p > 1) return { parcelado: true, totalParcelas: p }
  }

  if (norm.includes('parcelado') || norm.includes('parcelada')) {
    return { parcelado: true, totalParcelas: 2 }
  }

  return { parcelado: false }
}

/** Extrai data mencionada no comando */
export function extrairData(texto: string): string {
  const norm = normalizarTexto(texto)
  const hoje = new Date()

  if (norm.includes('ontem')) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0]
  }

  if (norm.includes('anteontem')) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - 2)
    return d.toISOString().split('T')[0]
  }

  if (norm.includes('amanha')) {
    const d = new Date(hoje)
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const mDiaMes = norm.match(/dia\s*(\d{1,2})(?:\/(\d{1,2}))?/)
  if (mDiaMes) {
    const dia = parseInt(mDiaMes[1], 10)
    const mes = mDiaMes[2] ? parseInt(mDiaMes[2], 10) - 1 : hoje.getMonth()
    const d = new Date(hoje.getFullYear(), mes, dia)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  return hoje.toISOString().split('T')[0]
}

/** Identifica banco ou cartão com base no catálogo do usuário */
export function identificarContaOuCartao(
  texto: string,
  bancos: Banco[],
  cartoes: Cartao[],
  parcelado: boolean
): {
  formaPagamento: 'cartao' | 'banco' | 'indefinido'
  bancoId?: string
  cartaoId?: string
  confianca: boolean
  aviso?: string
  termoIdentificado?: string
} {
  const norm = normalizarTexto(texto)

  const querCartao =
    parcelado ||
    norm.includes('cartao') ||
    norm.includes('credito') ||
    norm.includes('fatura')

  const querBanco =
    norm.includes('debito') ||
    norm.includes('pix') ||
    norm.includes('conta') ||
    norm.includes('saldo') ||
    norm.includes('transferencia')

  const cartoesNorm = cartoes.map(c => ({
    cartao: c,
    nome: normalizarTexto(c.nome),
    banco: c.banco ? normalizarTexto(c.banco) : '',
    bandeira: normalizarTexto(c.bandeira),
  }))

  const bancosNorm = bancos.map(b => ({
    banco: b,
    nome: normalizarTexto(b.nome),
    instituicao: normalizarTexto(b.instituicao),
  }))

  // 1. Se indicou explicitamente cartão ou parcelamento
  if (querCartao && !querBanco) {
    for (const item of cartoesNorm) {
      if (
        (item.nome && norm.includes(item.nome)) ||
        (item.banco && norm.includes(item.banco)) ||
        (item.bandeira && item.bandeira !== 'outro' && norm.includes(item.bandeira))
      ) {
        return {
          formaPagamento: 'cartao',
          cartaoId: item.cartao.id,
          confianca: true,
          termoIdentificado: item.cartao.nome,
        }
      }
    }
    if (cartoes.length === 1) {
      return { formaPagamento: 'cartao', cartaoId: cartoes[0].id, confianca: true, termoIdentificado: cartoes[0].nome }
    }
    if (cartoes.length > 1) {
      return {
        formaPagamento: 'cartao',
        cartaoId: cartoes[0]?.id,
        confianca: false,
        aviso: 'Cartão de crédito pré-selecionado. Verifique se é o cartão desejado.',
      }
    }
  }

  // 2. Se indicou débito/pix/conta
  if (querBanco && !querCartao) {
    for (const item of bancosNorm) {
      if (
        (item.nome && norm.includes(item.nome)) ||
        (item.instituicao && norm.includes(item.instituicao))
      ) {
        return { formaPagamento: 'banco', bancoId: item.banco.id, confianca: true, termoIdentificado: item.banco.nome }
      }
    }
    if (bancos.length === 1) {
      return { formaPagamento: 'banco', bancoId: bancos[0].id, confianca: true, termoIdentificado: bancos[0].nome }
    }
  }

  // 3. Procurar menções de nome (ex: "banco do brasil", "inter", "nubank", "itau")
  for (const item of cartoesNorm) {
    if (
      (item.nome && norm.includes(item.nome)) ||
      (item.banco && norm.includes(item.banco))
    ) {
      if (querCartao || !querBanco) {
        return { formaPagamento: 'cartao', cartaoId: item.cartao.id, confianca: true, termoIdentificado: item.cartao.nome }
      }
    }
  }

  for (const item of bancosNorm) {
    if (
      (item.nome && norm.includes(item.nome)) ||
      (item.instituicao && norm.includes(item.instituicao))
    ) {
      return { formaPagamento: 'banco', bancoId: item.banco.id, confianca: true, termoIdentificado: item.banco.nome }
    }
  }

  if (cartoes.length === 1 && bancos.length === 0) {
    return { formaPagamento: 'cartao', cartaoId: cartoes[0].id, confianca: true }
  }
  if (bancos.length === 1 && cartoes.length === 0) {
    return { formaPagamento: 'banco', bancoId: bancos[0].id, confianca: true }
  }

  return {
    formaPagamento: 'indefinido',
    bancoId: bancos[0]?.id,
    confianca: false,
    aviso: 'Não identificamos a conta ou cartão no comando. Selecione abaixo.',
  }
}

// ── MAPEAMENTO SEMÂNTICO DE ESTABELECIMENTOS PARA CATEGORIAS ──
const MAPA_DOMINIOS: Record<string, string[]> = {
  alimentacao: [
    'mercado', 'supermercado', 'hipermercado', 'mercearia', 'sacolao', 'hortifruti', 'feira',
    'restaurante', 'lanchonete', 'padaria', 'padoca', 'sorveteria', 'sorvete', 'acai',
    'pizzaria', 'pizza', 'hamburgueria', 'bar', 'boteco', 'pub', 'cafe', 'cafeteria',
    'ifood', 'rappi', 'almoco', 'jantar', 'lanche', 'refeicao', 'comida', 'churrascaria',
    'mcdonalds', 'burger king', 'subway', 'outback', 'carrefour', 'extra', 'pao de acucar',
    'assai', 'atacadao', 'dia', 'bistek', 'zaffari', 'firenze',
  ],
  transporte: [
    'posto', 'gasolina', 'combustivel', 'etanol', 'alcool', 'diesel', 'gnv',
    'shell', 'ipiranga', 'br', 'petrobras', 'auto posto', 'estacionamento', 'estapar',
    'pedagio', 'sem parar', 'conectcar', 'veloe', 'uber', '99', '99pop', 'taxi',
    'onibus', 'metro', 'passagem', 'oficina', 'mecanico', 'pneu', 'borracharia',
  ],
  saude: [
    'farmacia', 'drogaria', 'remedio', 'medicamento', 'drogasil', 'raia', 'drogaraia',
    'pacheco', 'sao paulo', 'panvel', 'pague menos', 'consulta', 'medico', 'dentista',
    'hospital', 'clinica', 'exame', 'laboratorio', 'otica', 'psicologo', 'fisioterapia',
  ],
  esportes: [
    'decathlon', 'centauro', 'nike', 'adidas', 'smart fit', 'academia', 'suplemento',
    'crossfit', 'esporte', 'esportes', 'tenis', 'futebol', 'natacao', 'ginasio',
  ],
  lazer: [
    'cinema', 'cinemark', 'cinepolis', 'filme', 'teatro', 'show', 'ingresso', 'sympla',
    'eventim', 'parque', 'viagem', 'hotel', 'pousada', 'airbnb', 'praia', 'jogo',
    'game', 'steam', 'playstation', 'xbox', 'nintendo', 'festa', 'balada', 'clube',
  ],
  vestuario: [
    'roupa', 'roupas', 'vestuario', 'calcado', 'calcados', 'sapato', 'tenis',
    'camisa', 'calca', 'loja', 'zara', 'renner', 'riachuelo', 'c&a', 'marisa',
    'hering', 'shopping', 'moda',
  ],
  moradia: [
    'aluguel', 'condominio', 'luz', 'energia', 'enel', 'cpfl', 'cemig', 'light',
    'agua', 'sabesp', 'sanepar', 'copasa', 'gas', 'ultragaz', 'internet',
    'claro', 'vivo', 'tim', 'oi', 'faxina', 'diarista', 'iptu', 'reforma',
  ],
  educacao: [
    'escola', 'colegio', 'faculdade', 'universidade', 'curso', 'mensalidade',
    'livro', 'livraria', 'apostila', 'udemy', 'alura', 'coursera', 'idiomas',
  ],
  assinaturas: [
    'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'max', 'youtube',
    'apple', 'google play', 'icloud', 'chatgpt',
  ],
}

/** Reconhece a melhor categoria com base no estabelecimento e categorias existentes */
export function identificarCategoria(
  texto: string,
  estabelecimento: string,
  categorias: Categoria[]
): { categoriaId?: string; categoriaNome?: string; confianca: boolean } {
  if (categorias.length === 0) {
    return { confianca: false }
  }

  const normTexto = normalizarTexto(texto)
  const normEstab = normalizarTexto(estabelecimento)
  const contexto = `${normEstab} ${normTexto}`

  const catsDespesa = categorias.filter(c => c.tipo === 'despesa' || c.tipo === 'ambos')
  const listaConsiderar = catsDespesa.length > 0 ? catsDespesa : categorias

  let melhorCategoria: Categoria | undefined
  let melhorPontuacao = 0

  for (const cat of listaConsiderar) {
    const normCat = normalizarTexto(cat.nome)
    let score = 0

    if (normTexto.includes(normCat) || normEstab.includes(normCat)) {
      score += 50
    }

    for (const [dominio, keywords] of Object.entries(MAPA_DOMINIOS)) {
      const catTemDominio =
        normCat.includes(dominio) ||
        (dominio === 'alimentacao' && (normCat.includes('refeicao') || normCat.includes('restaurante') || normCat.includes('mercado')))

      if (catTemDominio) {
        for (const kw of keywords) {
          if (contexto.includes(kw)) {
            score += 30
            if (normEstab.includes(kw)) score += 20
          }
        }
      }
    }

    if (score > melhorPontuacao) {
      melhorPontuacao = score
      melhorCategoria = cat
    }
  }

  if (melhorCategoria && melhorPontuacao >= 30) {
    return {
      categoriaId: melhorCategoria.id,
      categoriaNome: melhorCategoria.nome,
      confianca: true,
    }
  }

  return { confianca: false }
}

/** Extrai o nome do estabelecimento/local a partir do comando de voz */
export function extrairEstabelecimento(
  texto: string,
  bancos: Banco[] = [],
  cartoes: Cartao[] = []
): { descricao: string; confianca: boolean } {
  let res = texto.trim()

  // 1. Remover comandos iniciais
  res = res.replace(/^(?:lan[cç]ar|lan[cç]a|cadastrar|registrar|fazer|novo|nova)\s+(?:despesa|lan[cç]amento|gasto)?\s*/i, '')
  res = res.replace(/^(?:gastei|comprei|paguei)\s*/i, '')

  // 2. Remover menções de valor numérico ou extenso
  res = res.replace(/(?:valor\s+(?:de\s+)?|de\s+|por\s+)?r\$\s*[\d,.]+/gi, '')
  res = res.replace(/(?:valor\s+(?:de\s+)?|de\s+|por\s+)?(?:\d+|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil|\s+|e)+\s*(?:reais|real)\b/gi, '')
  res = res.replace(/(?:e|com)\s+[a-z0-9\s]+?\s*centavos\b/gi, '')

  // 3. Remover parcelamento
  res = res.replace(/(?:parcelad[oa]\s+(?:em\s+)?|em\s+|dividir\s+em\s+)?(?:\d+|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|doze)\s*(?:x|vezes|parcelas)\b/gi, '')
  res = res.replace(/\bparcelad[oa]\b/gi, '')

  // 4. Remover referências a bancos e cartões conhecidos (primeiro os nomes completos específicos)
  const todosNomesConhecidos: string[] = [
    ...bancos.map(b => b.nome),
    ...bancos.map(b => b.instituicao).filter((x): x is string => Boolean(x)),
    ...cartoes.map(c => c.nome),
    ...cartoes.map(c => c.banco).filter((x): x is string => Boolean(x)),
  ].filter((x): x is string => Boolean(x)).sort((a, b) => b.length - a.length)

  for (const n of todosNomesConhecidos) {
    if (!n) continue
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    res = res.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ')
  }

  // Em seguida remover termos genéricos de pagamento
  res = res.replace(/\b(?:no|com\s+o|na)\s+cart[aã]o\s+(?:de\s+cr[eé]dito\s+)?(?:do\s+banco\s+)?/gi, ' ')
  res = res.replace(/\bcart[aã]o\s+de\s+cr[eé]dito\b/gi, ' ')
  res = res.replace(/\bcart[aã]o\b/gi, ' ')
  res = res.replace(/\bcr[eé]dito\b/gi, ' ')
  res = res.replace(/\bd[eé]bito\b/gi, ' ')
  res = res.replace(/\bpix\b/gi, ' ')
  res = res.replace(/\bbanco\b/gi, ' ')

  // 5. Remover datas
  res = res.replace(/\b(hoje|ontem|anteontem|amanh[aã]|dia\s*\d{1,2}(?:\/\d{1,2})?)\b/gi, '')

  // 6. Limpar preposições e palavras funcionais remanescentes
  res = res.replace(/\b(?:para\s+o\s+estabelecimento|no\s+estabelecimento|na\s+loja|no\s+local|estabelecimento|loja)\s+/gi, '')
  res = res.replace(/\b(?:para\s+o|para\s+a|para|na|no|em|de|do|da)\s+/gi, ' ')
  res = res.replace(/[.,;:!?]/g, ' ')
  res = res.trim().replace(/\s+/g, ' ')

  // Remover artigos soltos no início
  res = res.replace(/^(o|a|os|as|um|uma|de|do|da)\s+/i, '').trim()

  if (res.length >= 2) {
    const formatada = res
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
    return { descricao: formatada, confianca: true }
  }

  return { descricao: '', confianca: false }
}

/**
 * Função principal de interpretação de voz.
 * Processa a fala com NLP local inteligente e integra com contas, cartões e categorias existentes.
 */
export function interpretarComandoVoz(
  textoOriginal: string,
  bancos: Banco[],
  cartoes: Cartao[],
  categorias: Categoria[]
): DadosLancamentoVoz {
  const avisos: string[] = []

  // 1. Extração do valor
  const { valor, confianca: confiancaValor } = extrairValor(textoOriginal)
  if (!confiancaValor || valor <= 0) {
    avisos.push('O valor da despesa não foi identificado com clareza. Por favor informe o valor.')
  }

  // 2. Extração de parcelamento
  const { parcelado, totalParcelas } = extrairParcelamento(textoOriginal)

  // 3. Extração da data
  const data = extrairData(textoOriginal)

  // 4. Identificação de conta ou cartão
  const { formaPagamento, bancoId, cartaoId, confianca: confiancaConta, aviso: avisoConta } =
    identificarContaOuCartao(textoOriginal, bancos, cartoes, parcelado)
  if (avisoConta) avisos.push(avisoConta)

  // 5. Extração do estabelecimento
  const { descricao, confianca: confiancaDescricao } = extrairEstabelecimento(textoOriginal, bancos, cartoes)
  if (!confiancaDescricao || !descricao) {
    avisos.push('Estabelecimento ou descrição não identificados. Por favor digite o nome do local.')
  }

  // 6. Reconhecimento automático de categoria
  const { categoriaId, categoriaNome, confianca: confiancaCategoria } =
    identificarCategoria(textoOriginal, descricao, categorias)
  if (!confiancaCategoria) {
    avisos.push('Selecione a categoria mais adequada para essa despesa.')
  }

  return {
    tipo: 'despesa',
    descricao: descricao || '',
    valor,
    data,
    formaPagamento,
    bancoId,
    cartaoId,
    categoriaId,
    categoriaNome,
    parcelado,
    totalParcelas: parcelado ? (totalParcelas ?? 2) : undefined,
    confianca: {
      valor: confiancaValor,
      descricao: confiancaDescricao,
      contaOuCartao: confiancaConta,
      categoria: confiancaCategoria,
      parcelas: parcelado ? totalParcelas !== undefined : true,
    },
    avisos,
    textoOriginal,
  }
}
