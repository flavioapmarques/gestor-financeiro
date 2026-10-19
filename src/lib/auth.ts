import { supabase } from './supabase'

/** Retorna o ID do usuário autenticado ou lança erro. */
export async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!user) throw new Error('Não autenticado')
  return user.id
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
