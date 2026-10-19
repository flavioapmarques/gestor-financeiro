import type { Categoria, CategoriaComFilhos } from './supabase'

/** Agrupa categorias em árvore: pais (sem parent_id) + subcategorias */
export function agruparCategorias(categorias: Categoria[]): CategoriaComFilhos[] {
  const pais = categorias.filter(c => !c.parent_id)
  const filhos = categorias.filter(c => c.parent_id)
  return pais.map(pai => ({
    ...pai,
    subcategorias: filhos.filter(f => f.parent_id === pai.id).sort((a, b) => a.nome.localeCompare(b.nome)),
  }))
}
