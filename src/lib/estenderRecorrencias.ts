import { supabase } from './supabase'
import { addFrequencia } from './lancamentos'
import type { Lancamento } from './supabase'

const DIAS_ANTES_DE_ESTENDER = 45
const MESES_A_ESTENDER = 12

/**
 * Verifica as séries recorrentes do usuário e, para as que estão perto de
 * "acabar" (a última ocorrência já gerada está a menos de 45 dias de hoje),
 * gera automaticamente mais ocorrências para o próximo ano.
 *
 * Sem isso, uma recorrência criada há ~1 ano simplesmente para de aparecer,
 * mesmo que o usuário nunca tenha pedido para encerrá-la.
 */
export async function estenderRecorrencias(userId: string): Promise<number> {
  const chaveSessao = `recorrencias-checadas-${userId}-${new Date().toISOString().slice(0, 10)}`
  if (sessionStorage.getItem(chaveSessao)) return 0

  const { data: recorrentes, error } = await supabase
    .from('lancamentos')
    .select('*')
    .eq('user_id', userId)
    .eq('recorrente', true)
    .order('data', { ascending: true })

  if (error || !recorrentes || recorrentes.length === 0) {
    sessionStorage.setItem(chaveSessao, '1')
    return 0
  }

  // Agrupa por série: recorrencia_pai_id (se existir) ou o próprio id (raiz da série)
  const grupos = new Map<string, Lancamento[]>()
  for (const l of recorrentes as Lancamento[]) {
    const chave = l.recorrencia_pai_id ?? l.id
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave)!.push(l)
  }

  const limite = new Date()
  limite.setDate(limite.getDate() + DIAS_ANTES_DE_ESTENDER)

  const novosRegistros: Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>[] = []
  const raizPorNovoRegistro: number[] = []

  for (const [raizId, itens] of grupos) {
    const ultimo = itens.reduce((max, l) => (l.data > max.data ? l : max), itens[0])
    if (!ultimo.frequencia) continue
    const dataUltima = new Date(`${ultimo.data}T12:00:00`)
    if (dataUltima > limite) continue // ainda tem ocorrências suficientes no futuro

    const fim = new Date(dataUltima)
    fim.setMonth(fim.getMonth() + MESES_A_ESTENDER)

    let dataAtual = ultimo.data
    let seguranca = 0
    while (seguranca < 60) {
      seguranca++
      dataAtual = addFrequencia(dataAtual, ultimo.frequencia)
      if (new Date(`${dataAtual}T12:00:00`) > fim) break
      const { id: _id, created_at: _c, updated_at: _u, ...resto } = ultimo
      novosRegistros.push({ ...resto, data: dataAtual, recorrencia_pai_id: raizId })
      raizPorNovoRegistro.push(novosRegistros.length - 1)
    }
  }

  if (novosRegistros.length > 0) {
    const { error: erroInsert } = await supabase.from('lancamentos').insert(novosRegistros)
    if (erroInsert) {
      console.error('Erro ao estender recorrências:', erroInsert.message)
      return 0
    }
  }

  sessionStorage.setItem(chaveSessao, '1')
  return novosRegistros.length
}
