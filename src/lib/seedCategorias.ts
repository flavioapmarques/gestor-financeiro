import { supabase } from './supabase'

const CATEGORIAS_PADRAO = [
  { nome: 'Salário', tipo: 'receita' as const, cor: '#22d4a0', icone: 'briefcase' },
  { nome: 'Freelance', tipo: 'receita' as const, cor: '#6C8EF5', icone: 'code' },
  { nome: 'Investimentos', tipo: 'receita' as const, cor: '#f5c842', icone: 'trending-up' },
  { nome: 'Outros (receita)', tipo: 'receita' as const, cor: '#b06ef5', icone: 'plus-circle' },
  { nome: 'Moradia', tipo: 'despesa' as const, cor: '#6C8EF5', icone: 'home' },
  { nome: 'Alimentação', tipo: 'despesa' as const, cor: '#22d4a0', icone: 'shopping-cart' },
  { nome: 'Transporte', tipo: 'despesa' as const, cor: '#f5c842', icone: 'car' },
  { nome: 'Saúde', tipo: 'despesa' as const, cor: '#ff6b7a', icone: 'heart' },
  { nome: 'Educação', tipo: 'despesa' as const, cor: '#b06ef5', icone: 'book' },
  { nome: 'Lazer', tipo: 'despesa' as const, cor: '#ff6b7a', icone: 'device-tv' },
  { nome: 'Vestuário', tipo: 'despesa' as const, cor: '#f5c842', icone: 'shirt' },
  { nome: 'Assinaturas', tipo: 'despesa' as const, cor: '#b06ef5', icone: 'refresh' },
  { nome: 'Outros (despesa)', tipo: 'despesa' as const, cor: '#5c6278', icone: 'dots-circle' },
]

/** Cria categorias padrão se o usuário ainda não tiver nenhuma (fallback ao trigger do banco). */
export async function ensureCategoriasPadrao(userId: string): Promise<void> {
  const { count, error: countError } = await supabase
    .from('categorias')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) {
    console.warn('Não foi possível verificar categorias:', countError.message)
    return
  }

  if (count && count > 0) return

  const rows = CATEGORIAS_PADRAO.map(c => ({ ...c, user_id: userId }))
  const { error } = await supabase.from('categorias').insert(rows)
  if (error) console.warn('Falha ao criar categorias padrão:', error.message)
}

/** Cria o perfil do usuário se não existir (fallback ao trigger do banco para usuários já existentes). */
export async function ensurePerfilExistente(userId: string, email?: string): Promise<void> {
  const { data, error } = await supabase
    .from('perfis')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('Não foi possível verificar perfil:', error.message)
    return
  }

  if (!data) {
    const nome = email ? email.split('@')[0] : 'Usuário'
    const { error: insertError } = await supabase
      .from('perfis')
      .insert({ user_id: userId, nome })
    if (insertError) {
      console.warn('Falha ao criar perfil automático:', insertError.message)
    }
  }
}

