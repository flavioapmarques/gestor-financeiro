import type { Lancamento, TipoLancamento } from './supabase'

export interface CategoriaSugerida {
  id: string
  nome: string
  cor?: string
  vezes: number
}

export interface SugestaoEstabelecimento {
  chave: string // normalizado (lowercase/trim), usado só para comparação
  descricao: string // texto original, como o usuário digitou da última vez
  vezes: number
  categorias: CategoriaSugerida[] // ordenadas da mais usada para a menos usada
}

type HistoricoItem = Pick<Lancamento, 'descricao' | 'tipo' | 'categoria_id' | 'data' | 'categoria'>

export function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

/** Agrupa o histórico por estabelecimento (descrição) e lista as categorias mais usadas para cada um. */
export function agruparHistoricoPorEstabelecimento(
  historico: HistoricoItem[],
  tipo: TipoLancamento
): Map<string, SugestaoEstabelecimento> {
  const grupos = new Map<string, {
    descricaoMaisRecente: string
    data: string
    vezes: number
    categorias: Map<string, CategoriaSugerida>
  }>()

  for (const item of historico) {
    if (item.tipo !== tipo) continue
    const desc = item.descricao?.trim()
    if (!desc) continue
    const chave = normalizar(desc)
    if (!grupos.has(chave)) {
      grupos.set(chave, { descricaoMaisRecente: desc, data: item.data, vezes: 0, categorias: new Map() })
    }
    const grupo = grupos.get(chave)!
    grupo.vezes++
    if (item.data > grupo.data) {
      grupo.descricaoMaisRecente = desc
      grupo.data = item.data
    }
    if (item.categoria_id && item.categoria) {
      const catAtual = grupo.categorias.get(item.categoria_id)
      grupo.categorias.set(item.categoria_id, {
        id: item.categoria_id,
        nome: item.categoria.nome,
        cor: item.categoria.cor,
        vezes: (catAtual?.vezes ?? 0) + 1,
      })
    }
  }

  const resultado = new Map<string, SugestaoEstabelecimento>()
  for (const [chave, grupo] of grupos) {
    resultado.set(chave, {
      chave,
      descricao: grupo.descricaoMaisRecente,
      vezes: grupo.vezes,
      categorias: Array.from(grupo.categorias.values()).sort((a, b) => b.vezes - a.vezes),
    })
  }
  return resultado
}

/** Filtra e ordena sugestões que combinam com o texto digitado, priorizando mais usadas/recentes. */
export function buscarSugestoes(
  index: Map<string, SugestaoEstabelecimento>,
  termo: string,
  limite = 6
): SugestaoEstabelecimento[] {
  const alvo = normalizar(termo)
  if (!alvo) return []
  return Array.from(index.values())
    .filter(s => s.chave.includes(alvo))
    .sort((a, b) => b.vezes - a.vezes)
    .slice(0, limite)
}

/**
 * Sugere a categoria mais usada para um lançamento a partir de uma descrição "suja"
 * (ex.: "COMPRA POSTO FERRARI 05/06 SP" vindo de um extrato OFX) — verifica se algum
 * estabelecimento já conhecido está contido no texto, ao invés do autocomplete normal
 * (que faz o caminho inverso: procura o texto digitado dentro dos nomes conhecidos).
 */
export function sugerirCategoriaPorDescricao(
  index: Map<string, SugestaoEstabelecimento>,
  descricaoBruta: string
): CategoriaSugerida | null {
  const alvo = normalizar(descricaoBruta)
  if (!alvo) return null
  let melhor: SugestaoEstabelecimento | null = null
  for (const s of index.values()) {
    if (s.chave.length < 3) continue // evita match com nomes curtos demais (ruído)
    if (alvo.includes(s.chave) && (!melhor || s.chave.length > melhor.chave.length)) {
      melhor = s
    }
  }
  return melhor?.categorias[0] ?? null
}
