import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requireUserId } from '../lib/auth'
import { useStore } from '../lib/store'
import { gerarParcelas, gerarRecorrencias, tagPagamentoFatura, mesVencimentoFatura, mesEfetivo, isPagamentoFatura } from '../lib/lancamentos'
import { primeiroDiaMes, ultimoDiaMes, subtrairMeses } from '../lib/utils'
import {
  supabase,
  type Lancamento,
  type Banco,
  type Cartao,
  type Meta,
  type Categoria,
  type Perfil,
  type Notificacao,
  type Insight,
  type Orcamento,
  type Bandeira,
} from '../lib/supabase'

// ── BANCOS ─────────────────────────────────────────────────
export function useBancos() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['bancos', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('saldo_bancos')
        .select('*')
        .eq('user_id', uid)
        .order('instituicao')
      if (error) throw error
      return data as Banco[]
    },
  })
}

/** @deprecated use useBancos */
export const useContas = useBancos

export function useAdicionarBanco() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (banco: {
      nome: string
      instituicao: string
      tipo: Banco['tipo']
      saldo_inicial: number
      data_saldo_inicial: string
      agencia?: string
      numero_conta?: string
      cor?: string
      icone?: string
      observacao?: string
    }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('bancos')
        .insert({ ...banco, user_id: uid, ativo: true })
        .select()
        .single()
      if (error) throw error
      return data as Banco
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bancos', userId] }),
  })
}

export function useAtualizarBanco() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Banco> & { id: string }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('bancos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) throw error
      return data as Banco
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bancos', userId] }),
  })
}

export function useDeletarBanco() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId()
      const { error } = await supabase.from('bancos').delete().eq('id', id).eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bancos', userId] })
      qc.invalidateQueries({ queryKey: ['saldos-bancos-fim-mes', userId] })
    },
  })
}

/** Calcula o saldo acumulado de cada banco até o último dia do mês/ano informado */
export function useSaldosBancosFimDoMes(mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['saldos-bancos-fim-mes', userId, mes, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const fim = ultimoDiaMes(mes, ano)

      const [bancosRes, lancamentosRes] = await Promise.all([
        supabase.from('bancos').select('*').eq('user_id', uid).order('instituicao'),
        supabase
          .from('lancamentos')
          .select('tipo, valor, banco_id, banco_destino_id, efetivado, data, tags')
          .eq('user_id', uid)
          .eq('efetivado', true)
          .lte('data', fim),
      ])

      if (bancosRes.error) throw bancosRes.error
      if (lancamentosRes.error) throw lancamentosRes.error

      const bancos = bancosRes.data as Banco[]
      const lancamentos = lancamentosRes.data as {
        tipo: 'receita' | 'despesa' | 'transferencia'
        valor: number
        banco_id: string | null
        banco_destino_id: string | null
        efetivado: boolean
        data: string
        tags?: string[] | null
      }[]

      const saldosMap = new Map<string, number>()
      for (const b of bancos) {
        saldosMap.set(b.id, Number(b.saldo_inicial ?? 0))
      }

      for (const l of lancamentos) {
        if (l.tags?.includes('ignorar')) continue
        if (l.tipo === 'receita' && l.banco_id && saldosMap.has(l.banco_id)) {
          saldosMap.set(l.banco_id, (saldosMap.get(l.banco_id) ?? 0) + Number(l.valor))
        } else if (l.tipo === 'despesa' && l.banco_id && saldosMap.has(l.banco_id)) {
          saldosMap.set(l.banco_id, (saldosMap.get(l.banco_id) ?? 0) - Number(l.valor))
        } else if (l.tipo === 'transferencia') {
          if (l.banco_id && saldosMap.has(l.banco_id)) {
            saldosMap.set(l.banco_id, (saldosMap.get(l.banco_id) ?? 0) - Number(l.valor))
          }
          if (l.banco_destino_id && saldosMap.has(l.banco_destino_id)) {
            saldosMap.set(l.banco_destino_id, (saldosMap.get(l.banco_destino_id) ?? 0) + Number(l.valor))
          }
        }
      }

      return saldosMap
    },
  })
}

// ── CATEGORIAS ─────────────────────────────────────────────
export function useCategorias() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['categorias', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('categorias')
        .select('*')
        .eq('user_id', uid)
        .order('nome')
      if (error) throw error
      return data as Categoria[]
    },
  })
}

// ── CARTÕES ────────────────────────────────────────────────
export function useCartoes() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['cartoes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .eq('user_id', uid)
        .eq('ativo', true)
        .order('nome')
      if (error) throw error
      return data as Cartao[]
    },
  })
}

// ── LANÇAMENTOS ────────────────────────────────────────────
export function useLancamentos(mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos', userId, mes, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const inicio = primeiroDiaMes(mes, ano)
      const fim = ultimoDiaMes(mes, ano)
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          categoria:categorias!categoria_id(id, nome, cor, icone),
          banco:bancos!banco_id(id, nome, instituicao, cor),
          banco_destino:bancos!banco_destino_id(id, nome, instituicao, cor),
          cartao:cartoes!cartao_id(id, nome, bandeira)
        `)
        .eq('user_id', uid)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

/**
 * Como useLancamentos, mas agrupa pelo mês em que o dinheiro realmente saiu do bolso:
 * compras no cartão contam no mês da fatura (pagamento), não no mês da compra.
 * O pagamento da fatura em si é excluído (a compra já representa aquele gasto).
 * Usado nos Relatórios e na Home para não misturar "mês da compra" com "mês da fatura".
 */
export function useLancamentosEfetivos(mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos-efetivos', userId, mes, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      // Busca com folga de ~31 dias pra trás: uma compra feita no fim do mês anterior
      // pode só "fechar" na fatura deste mês.
      const inicioBuffer = new Date(`${primeiroDiaMes(mes, ano)}T12:00:00`)
      inicioBuffer.setDate(inicioBuffer.getDate() - 31)
      const inicio = inicioBuffer.toISOString().slice(0, 10)
      const fim = ultimoDiaMes(mes, ano)

      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          categoria:categorias!categoria_id(id, nome, cor, icone),
          banco:bancos!banco_id(id, nome, instituicao, cor),
          banco_destino:bancos!banco_destino_id(id, nome, instituicao, cor),
          cartao:cartoes!cartao_id(id, nome, bandeira, dia_fechamento, dia_vencimento)
        `)
        .eq('user_id', uid)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
      if (error) throw error
      const todos = data as unknown as (Lancamento & { cartao?: { dia_fechamento?: number; dia_vencimento?: number } | null })[]

      return todos.filter(l => {
        if (isPagamentoFatura(l.tags)) return false
        const efetivo = mesEfetivo(l, l.cartao?.dia_fechamento, l.cartao?.dia_vencimento)
        return efetivo.mes === mes && efetivo.ano === ano
      }) as Lancamento[]
    },
  })
}

/** Histórico leve (só os campos necessários) para alimentar o autocomplete de descrição → categoria. */
export function useHistoricoDescricoes() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['historico-descricoes', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('lancamentos')
        .select('descricao, tipo, categoria_id, data, categoria:categorias!categoria_id(id, nome, cor, icone)')
        .eq('user_id', uid)
        .neq('tipo', 'transferencia')
        .order('data', { ascending: false })
        .limit(800)
      if (error) throw error
      return data as unknown as Pick<Lancamento, 'descricao' | 'tipo' | 'categoria_id' | 'data' | 'categoria'>[]
    },
  })
}

export function useLancamentosAno(ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos-ano', userId, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          categoria:categorias!categoria_id(id, nome, cor, icone),
          banco:bancos!banco_id(id, nome, instituicao, cor),
          banco_destino:bancos!banco_destino_id(id, nome, instituicao, cor),
          cartao:cartoes!cartao_id(id, nome, bandeira)
        `)
        .eq('user_id', uid)
        .gte('data', `${ano}-01-01`)
        .lte('data', `${ano}-12-31`)
        .order('data', { ascending: false })
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

/** Equivalente a useLancamentosAno, mas por mês efetivo (mês de pagamento da fatura), igual useLancamentosEfetivos. */
export function useLancamentosAnoEfetivo(ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos-ano-efetivos', userId, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const inicioBuffer = new Date(`${ano}-01-01T12:00:00`)
      inicioBuffer.setDate(inicioBuffer.getDate() - 31)
      const inicio = inicioBuffer.toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('lancamentos')
        .select(`
          *,
          categoria:categorias!categoria_id(id, nome, cor, icone),
          banco:bancos!banco_id(id, nome, instituicao, cor),
          banco_destino:bancos!banco_destino_id(id, nome, instituicao, cor),
          cartao:cartoes!cartao_id(id, nome, bandeira, dia_fechamento, dia_vencimento)
        `)
        .eq('user_id', uid)
        .gte('data', inicio)
        .lte('data', `${ano}-12-31`)
        .order('data', { ascending: false })
      if (error) throw error
      const todos = data as unknown as (Lancamento & { cartao?: { dia_fechamento?: number; dia_vencimento?: number } | null })[]

      return todos.filter(l => {
        if (isPagamentoFatura(l.tags)) return false
        return mesEfetivo(l, l.cartao?.dia_fechamento, l.cartao?.dia_vencimento).ano === ano
      }) as Lancamento[]
    },
  })
}

// ── METAS ──────────────────────────────────────────────────
export function useMetas() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['metas', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('metas')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Meta[]
    },
  })
}

// ── IMPORTAÇÃO DE EXTRATO (OFX) ─────────────────────────────
/**
 * Busca os FITIDs (identificador único de cada transação no arquivo OFX) já
 * importados anteriormente para essa conta/cartão, pra não duplicar lançamentos
 * quando o usuário importa o mesmo extrato (ou um período sobreposto) de novo.
 */
export async function buscarFitidsJaImportados(
  destino: { tipo: 'banco' | 'cartao'; id: string }
): Promise<Set<string>> {
  const uid = await requireUserId()
  const coluna = destino.tipo === 'banco' ? 'banco_id' : 'cartao_id'
  const { data, error } = await supabase
    .from('lancamentos')
    .select('tags')
    .eq('user_id', uid)
    .eq(coluna, destino.id)
    .not('tags', 'is', null)
  if (error) throw error

  const fitids = new Set<string>()
  for (const row of data as { tags: string[] | null }[]) {
    for (const tag of row.tags ?? []) {
      if (tag.startsWith('ofx:')) fitids.add(tag.slice(4))
    }
  }
  return fitids
}

/** Lançamentos usados pela conciliação OFX da conta ou cartão selecionado. */
export function useLancamentosParaConciliacao(destino: { tipo: 'banco' | 'cartao'; id: string } | null) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos-conciliacao', userId, destino?.tipo, destino?.id],
    enabled: !!userId && !!destino?.id,
    queryFn: async () => {
      const uid = await requireUserId()
      const coluna = destino!.tipo === 'banco' ? 'banco_id' : 'cartao_id'
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`*, categoria:categorias!categoria_id(id, nome, cor, icone), banco:bancos!banco_id(id, nome, instituicao, cor), cartao:cartoes!cartao_id(id, nome, bandeira)`)
        .eq('user_id', uid)
        .eq(coluna, destino!.id)
        .order('data', { ascending: false })
        .limit(1000)
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

export interface TransacaoParaImportar {
  fitid: string
  data: string
  valor: number
  tipo: 'receita' | 'despesa'
  descricao: string
  categoria_id?: string
  observacao?: string
}

export interface ConciliacaoParaImportar {
  fitid: string
  data: string
  valor: number
  tipo: 'receita' | 'despesa'
  descricao: string
  score: number
  status: 'ja_lancado' | 'possivel' | 'nao_lancado' | 'duplicidade'
  lancamento_id?: string
}

export function useImportarOfx() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({
      transacoes,
      destino,
      arquivoNome,
      origem,
      conciliacoes,
    }: {
      transacoes: TransacaoParaImportar[]
      destino: { tipo: 'banco' | 'cartao'; id: string; diaFechamento?: number; diaVencimento?: number }
      arquivoNome: string
      origem: 'conta' | 'cartao' | 'desconhecida'
      conciliacoes: ConciliacaoParaImportar[]
    }) => {
      const uid = await requireUserId()
      if (transacoes.length === 0) return { inseridos: 0 }

      const totalSelecionado = new Set(transacoes.map(item => item.fitid))
      const contagem = (status: ConciliacaoParaImportar['status']) => conciliacoes.filter(item => item.status === status).length

      // 1. Tenta criar o registro em ofx_importacoes (se a tabela existir no Supabase)
      let importacaoId: string | null = null
      try {
        const { data: importacao } = await supabase
          .from('ofx_importacoes')
          .insert({
            user_id: uid,
            banco_id: destino.tipo === 'banco' ? destino.id : null,
            cartao_id: destino.tipo === 'cartao' ? destino.id : null,
            arquivo_nome: arquivoNome,
            origem,
            total_transacoes: conciliacoes.length,
            total_ja_lancadas: contagem('ja_lancado'),
            total_possiveis: contagem('possivel'),
            total_nao_lancadas: contagem('nao_lancado'),
            total_duplicidades: contagem('duplicidade'),
            total_ignoradas: conciliacoes.length - totalSelecionado.size,
          })
          .select('id')
          .maybeSingle()
        if (importacao) importacaoId = importacao.id
      } catch (err) {
        console.warn('Registro em ofx_importacoes ignorado (tabela opcional):', err)
      }

      // 2. Mapeia os lançamentos para inserção
      const registros = transacoes.map(t => {
        const dataVencimentoParcela =
          destino.tipo === 'cartao' && destino.diaFechamento != null && destino.diaVencimento != null && t.tipo === 'despesa'
            ? (() => {
                const venc = mesVencimentoFatura(t.data, destino.diaFechamento!, destino.diaVencimento!)
                const ultimoDia = new Date(venc.ano, venc.mes, 0).getDate()
                const dia = Math.min(destino.diaVencimento!, ultimoDia)
                return `${venc.ano}-${String(venc.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
              })()
            : undefined

        return {
          user_id: uid,
          tipo: t.tipo,
          descricao: t.descricao,
          valor: t.valor,
          data: t.data,
          categoria_id: t.categoria_id || undefined,
          observacao: t.observacao || undefined,
          banco_id: destino.tipo === 'banco' ? destino.id : undefined,
          cartao_id: destino.tipo === 'cartao' ? destino.id : undefined,
          ofx_transacao_id: t.fitid,
          parcelado: false,
          recorrente: false,
          efetivado: true, // já aconteceu de verdade — veio do extrato do banco/cartão
          tags: [`ofx:${t.fitid}`],
          data_vencimento_parcela: dataVencimentoParcela,
        }
      })

      // 3. Insere os lançamentos no banco de dados
      let inseridosData: { id: string; ofx_transacao_id?: string }[] | null = null
      const { data: inseridosRes, error: insercaoError } = await supabase
        .from('lancamentos')
        .insert(registros)
        .select('id, ofx_transacao_id')

      if (insercaoError) {
        // Se falhar porque a coluna ofx_transacao_id ainda não foi criada no banco
        if (insercaoError.message?.includes('ofx_transacao_id') || insercaoError.code === 'PGRST204') {
          const registrosSemOfxId = registros.map(({ ofx_transacao_id, ...r }) => r)
          const { error: retryError } = await supabase.from('lancamentos').insert(registrosSemOfxId)
          if (retryError) {
            throw new Error(retryError.message || retryError.details || 'Erro ao salvar lançamentos no banco.')
          }
          return { inseridos: registros.length }
        }
        throw new Error(insercaoError.message || insercaoError.details || 'Erro ao salvar lançamentos no banco.')
      }

      inseridosData = inseridosRes

      // 4. Salva detalhamento das transações se ofx_transacoes existir
      if (importacaoId && inseridosData) {
        try {
          const idsPorFitid = new Map((inseridosData ?? []).map(item => [item.ofx_transacao_id, item.id]))
          await supabase.from('ofx_transacoes').insert(conciliacoes.map(item => ({
            importacao_id: importacaoId,
            user_id: uid,
            banco_id: destino.tipo === 'banco' ? destino.id : null,
            cartao_id: destino.tipo === 'cartao' ? destino.id : null,
            fitid: item.fitid,
            data: item.data,
            valor: item.valor,
            tipo: item.tipo,
            descricao: item.descricao,
            score: item.score,
            status: totalSelecionado.has(item.fitid) ? 'importado' : item.status,
            lancamento_id: idsPorFitid.get(item.fitid) ?? item.lancamento_id ?? null,
          })))
        } catch (err) {
          console.warn('Registro em ofx_transacoes ignorado (tabela opcional):', err)
        }
      }

      return { inseridos: registros.length }
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

export function useVincularLancamentoOfx() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ lancamentoId, fitid }: { lancamentoId: string; fitid: string }) => {
      const uid = await requireUserId()
      const { data: atual, error: buscaError } = await supabase
        .from('lancamentos')
        .select('tags')
        .eq('id', lancamentoId)
        .eq('user_id', uid)
        .single()
      if (buscaError) throw buscaError

      const tags = Array.from(new Set([...(atual.tags ?? []), `ofx:${fitid}`]))
      const { data, error } = await supabase
        .from('lancamentos')
        .update({ tags, updated_at: new Date().toISOString() })
        .eq('id', lancamentoId)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) throw error
      return data as Lancamento
    },
    onSuccess: () => {
      invalidateDadosFinanceiros(qc, userId)
      qc.invalidateQueries({ queryKey: ['lancamentos-conciliacao', userId] })
    },
  })
}

export function useHistoricoImportacoesOfx() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['historico-importacoes-ofx', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('ofx_importacoes')
        .select('*, banco:bancos(nome, instituicao), cartao:cartoes(nome)')
        .eq('user_id', uid)
        .order('importado_em', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as Array<{
        id: string
        arquivo_nome: string
        importado_em: string
        total_transacoes: number
        total_ja_lancadas: number
        total_possiveis: number
        total_nao_lancadas: number
        total_duplicidades: number
        total_ignoradas: number
        banco?: { nome: string; instituicao: string } | null
        cartao?: { nome: string } | null
      }>
    },
  })
}

// ── ORÇAMENTOS ─────────────────────────────────────────────
/** Orçamentos recorrentes (mes/ano nulos) valem para todo mês; um registro com mes/ano
 * preenchidos sobrepõe o recorrente apenas naquele mês específico. */
export function useOrcamentos(mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['orcamentos', userId, mes, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('orcamentos')
        .select('*, categoria:categorias!categoria_id(id, nome, cor, icone)')
        .eq('user_id', uid)
        .or(`and(mes.is.null,ano.is.null),and(mes.eq.${mes},ano.eq.${ano})`)
      if (error) throw error
      const todos = data as unknown as Orcamento[]
      // Se existir um orçamento específico do mês para uma categoria, ele sobrepõe o recorrente
      const porCategoria = new Map<string, Orcamento>()
      for (const o of todos) {
        const existente = porCategoria.get(o.categoria_id)
        const ehEspecifico = o.mes != null && o.ano != null
        if (!existente || ehEspecifico) porCategoria.set(o.categoria_id, o)
      }
      return Array.from(porCategoria.values())
    },
  })
}

export function useAdicionarOrcamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (orcamento: { categoria_id: string; valor_limite: number; mes?: number; ano?: number }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('orcamentos')
        .insert({ ...orcamento, user_id: uid })
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos', userId] }),
  })
}

export function useAtualizarOrcamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; valor_limite: number }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('orcamentos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos', userId] }),
  })
}

export function useDeletarOrcamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId()
      const { error } = await supabase.from('orcamentos').delete().eq('id', id).eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos', userId] }),
  })
}


export function useResumoDashboard(mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['resumo', userId, mes, ano],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('resumo_categorias')
        .select('*')
        .eq('user_id', uid)
        .eq('mes', mes)
        .eq('ano', ano)
      if (error) throw error
      return data
    },
  })
}

function invalidateDadosFinanceiros(qc: ReturnType<typeof useQueryClient>, userId: string | null) {
  qc.invalidateQueries({ queryKey: ['lancamentos', userId] })
  qc.invalidateQueries({ queryKey: ['lancamentos-efetivos', userId] })
  qc.invalidateQueries({ queryKey: ['lancamentos-ano', userId] })
  qc.invalidateQueries({ queryKey: ['lancamentos-ano-efetivos', userId] })
  qc.invalidateQueries({ queryKey: ['lancamentos-cartao', userId] })
  qc.invalidateQueries({ queryKey: ['faturas', userId] })
  qc.invalidateQueries({ queryKey: ['resumo', userId] })
  qc.invalidateQueries({ queryKey: ['bancos', userId] })
  qc.invalidateQueries({ queryKey: ['saldos-bancos-fim-mes', userId] })
  qc.invalidateQueries({ queryKey: ['pagamento-fatura', userId] })
  qc.invalidateQueries({ queryKey: ['evolucao-mensal', userId] })
  qc.invalidateQueries({ queryKey: ['historico-descricoes', userId] })
  qc.invalidateQueries({ queryKey: ['limite-utilizado-cartao', userId] })
}

// ── MUTATIONS ──────────────────────────────────────────────
/**
 * Se a compra pertence a um cartão cuja fatura daquele mês já foi paga, bloqueia a ação
 * (criar/editar/excluir). O usuário precisa reabrir a fatura primeiro — assim o app nunca
 * fica com uma compra alterada sem refletir no valor que já saiu da conta.
 */
async function bloquearSeFaturaPaga(
  uid: string,
  cartaoId: string | null | undefined,
  data: string,
  dataVencimentoParcela?: string | null,
  diaFechamentoConhecido?: number,
  diaVencimentoConhecido?: number
) {
  if (!cartaoId) return
  let mes: number, ano: number
  if (dataVencimentoParcela) {
    const [a, m] = dataVencimentoParcela.split('-').map(Number)
    ano = a; mes = m
  } else {
    let diaFechamento = diaFechamentoConhecido
    let diaVencimento = diaVencimentoConhecido
    if (diaFechamento == null || diaVencimento == null) {
      const { data: cartao } = await supabase
        .from('cartoes')
        .select('dia_fechamento, dia_vencimento')
        .eq('id', cartaoId)
        .eq('user_id', uid)
        .maybeSingle()
      diaFechamento = cartao?.dia_fechamento ?? undefined
      diaVencimento = cartao?.dia_vencimento ?? undefined
    }
    if (diaFechamento == null || diaVencimento == null) return
    const venc = mesVencimentoFatura(data, diaFechamento, diaVencimento)
    mes = venc.mes; ano = venc.ano
  }
  const tag = tagPagamentoFatura(cartaoId, mes, ano)
  const { data: pago } = await supabase
    .from('lancamentos')
    .select('id')
    .eq('user_id', uid)
    .contains('tags', [tag])
    .maybeSingle()
  if (pago) {
    throw new Error(`A fatura de ${String(mes).padStart(2, '0')}/${ano} já foi paga. Reabra a fatura na tela do cartão para poder alterar essa compra.`)
  }
}

export function useAdicionarLancamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (lancamento: Omit<Lancamento, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const uid = await requireUserId()

      let diaFechamento: number | undefined
      let diaVencimento: number | undefined
      if (lancamento.cartao_id) {
        const { data: cartao } = await supabase
          .from('cartoes')
          .select('dia_fechamento, dia_vencimento')
          .eq('id', lancamento.cartao_id)
          .eq('user_id', uid)
          .maybeSingle()
        diaFechamento = cartao?.dia_fechamento ?? undefined
        diaVencimento = cartao?.dia_vencimento ?? undefined
      }

      let registros: Omit<Lancamento, 'id' | 'user_id' | 'created_at' | 'updated_at'>[]
      if (lancamento.parcelado && lancamento.total_parcelas && lancamento.total_parcelas > 1) {
        registros = gerarParcelas(lancamento, diaFechamento, diaVencimento)
      } else if (lancamento.recorrente && lancamento.frequencia) {
        registros = gerarRecorrencias(lancamento)
      } else {
        registros = [lancamento]
      }

      for (const r of registros) {
        if (r.cartao_id) {
          await bloquearSeFaturaPaga(uid, r.cartao_id, r.data, r.data_vencimento_parcela, diaFechamento, diaVencimento)
        }
      }

      const payload = registros.map(r => ({ ...r, user_id: uid }))
      const { data: inseridos, error } = await supabase.from('lancamentos').insert(payload).select()
      if (error) throw error

      if (lancamento.recorrente && inseridos && inseridos.length > 1) {
        const paiId = inseridos[0].id
        const filhosIds = inseridos.slice(1).map(r => r.id)
        await supabase
          .from('lancamentos')
          .update({ recorrencia_pai_id: paiId })
          .in('id', filhosIds)
          .eq('user_id', uid)
      }

      return inseridos
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

export function useDeletarLancamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, deletarFuturas, grupoParcela }: { id: string; deletarFuturas?: boolean; grupoParcela?: string }) => {
      const uid = await requireUserId()

      const { data: atual } = await supabase
        .from('lancamentos')
        .select('cartao_id, data, data_vencimento_parcela')
        .eq('id', id)
        .eq('user_id', uid)
        .maybeSingle()
      if (atual?.cartao_id) {
        await bloquearSeFaturaPaga(uid, atual.cartao_id, atual.data, atual.data_vencimento_parcela)
      }

      if (deletarFuturas && grupoParcela) {
        const { error } = await supabase
          .from('lancamentos')
          .delete()
          .eq('grupo_parcela_id', grupoParcela)
          .eq('user_id', uid)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('lancamentos')
          .delete()
          .eq('id', id)
          .eq('user_id', uid)
        if (error) throw error
      }
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

export function useAtualizarLancamento() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      escopoParcela,
      grupoParcelaId,
      parcelaAtual,
    }: {
      id: string
      updates: Partial<
        Omit<
          Lancamento,
          'id' | 'user_id' | 'created_at' | 'updated_at' | 'categoria' | 'banco' | 'banco_destino' | 'cartao'
        >
      >
      escopoParcela?: 'apenas_esta' | 'esta_e_proximas' | 'todas'
      grupoParcelaId?: string
      parcelaAtual?: number
    }) => {
      const uid = await requireUserId()

      const { data: atual } = await supabase
        .from('lancamentos')
        .select('cartao_id, data, data_vencimento_parcela')
        .eq('id', id)
        .eq('user_id', uid)
        .maybeSingle()
      if (atual?.cartao_id) {
        await bloquearSeFaturaPaga(uid, atual.cartao_id, atual.data, atual.data_vencimento_parcela)
      }

      if (escopoParcela && escopoParcela !== 'apenas_esta' && grupoParcelaId) {
        let query = supabase
          .from('lancamentos')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('grupo_parcela_id', grupoParcelaId)
          .eq('user_id', uid)

        if (escopoParcela === 'esta_e_proximas' && parcelaAtual != null) {
          query = query.gte('parcela_atual', parcelaAtual)
        }

        const { error } = await query
        if (error) throw error
        return null
      } else {
        const { data, error } = await supabase
          .from('lancamentos')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', uid)
          .select()
          .single()
        if (error) throw error
        return data as Lancamento
      }
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

export function usePagamentoFatura(cartaoId: string, mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  const tag = tagPagamentoFatura(cartaoId, mes, ano)
  return useQuery({
    queryKey: ['pagamento-fatura', userId, cartaoId, mes, ano],
    enabled: !!userId && !!cartaoId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`*, banco:bancos!banco_id(id, nome, instituicao)`)
        .eq('user_id', uid)
        .contains('tags', [tag])
        .maybeSingle()
      if (error) throw error
      return data as (Lancamento & { banco?: Banco }) | null
    },
  })
}

export function usePagarFatura() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({
      cartaoId,
      cartaoNome,
      bancoId,
      mes,
      ano,
      valor,
      dataPagamento,
    }: {
      cartaoId: string
      cartaoNome: string
      bancoId: string
      mes: number
      ano: number
      valor: number
      dataPagamento: string
    }) => {
      const uid = await requireUserId()
      const tag = tagPagamentoFatura(cartaoId, mes, ano)

      const { data: existente } = await supabase
        .from('lancamentos')
        .select('id')
        .eq('user_id', uid)
        .contains('tags', [tag])
        .maybeSingle()

      if (existente) throw new Error('Esta fatura já foi paga')

      const { data, error } = await supabase
        .from('lancamentos')
        .insert({
          user_id: uid,
          tipo: 'despesa',
          descricao: `Pagamento fatura ${cartaoNome}`,
          valor,
          data: dataPagamento,
          banco_id: bancoId,
          efetivado: true,
          parcelado: false,
          recorrente: false,
          tags: [tag],
          observacao: `Fatura ${String(mes).padStart(2, '0')}/${ano}`,
        })
        .select()
        .single()

      if (error) throw error
      return data as Lancamento
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

/**
 * "Desfaz" o pagamento de uma fatura: apaga o lançamento de pagamento (o saldo da conta
 * volta sozinho, já que é calculado ao vivo pela soma dos lançamentos efetivados) e volta
 * a permitir editar/excluir as compras daquele mês e lançar novas compras nele.
 */
export function useReabrirFatura() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (pagamentoId: string) => {
      const uid = await requireUserId()
      const { error } = await supabase.from('lancamentos').delete().eq('id', pagamentoId).eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}

export function useAdicionarMeta() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (meta: Omit<Meta, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('metas')
        .insert({ ...meta, user_id: uid })
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas', userId] }),
  })
}

export function useAtualizarMeta() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Meta> & { id: string }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('metas')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['metas', userId] }),
  })
}

// ── CATEGORIAS (CRUD + subcategorias) ───────────────────────
export function useAdicionarCategoria() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (cat: Pick<Categoria, 'nome' | 'tipo' | 'cor' | 'icone'> & { parent_id?: string }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('categorias')
        .insert({ ...cat, user_id: uid })
        .select()
        .single()
      if (error) throw error
      return data as Categoria
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', userId] }),
  })
}

export function useAtualizarCategoria() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Categoria> & { id: string }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('categorias')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) throw error
      return data as Categoria
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', userId] }),
  })
}

export function useDeletarCategoria() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId()
      const { error } = await supabase.from('categorias').delete().eq('id', id).eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias', userId] }),
  })
}

// ── CARTÕES (CRUD) ─────────────────────────────────────────
export function useAdicionarCartao() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (cartao: {
      nome: string
      banco?: string
      bandeira: Bandeira
      limite: number
      dia_fechamento: number
      dia_vencimento: number
      cor: string
      banco_pagamento_id?: string
    }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('cartoes')
        .insert({ ...cartao, user_id: uid, ativo: true })
        .select()
        .single()
      if (error) throw error
      return data as Cartao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes', userId] })
      qc.invalidateQueries({ queryKey: ['faturas', userId] })
    },
  })
}

export function useAtualizarCartao() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Cartao> & { id: string }) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('cartoes')
        .update(updates)
        .eq('id', id)
        .eq('user_id', uid)
        .select()
        .single()
      if (error) throw error
      return data as Cartao
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cartoes', userId] })
      qc.invalidateQueries({ queryKey: ['faturas', userId] })
    },
  })
}

export function useDeletarCartao() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (id: string) => {
      const uid = await requireUserId()

      // 1. Deleta todas as compras e lançamentos vinculados diretamente ao cartão
      const { error: errLancamentos } = await supabase
        .from('lancamentos')
        .delete()
        .eq('cartao_id', id)
        .eq('user_id', uid)
      if (errLancamentos) throw errLancamentos

      // 2. Deleta os lançamentos de pagamento de fatura deste cartão (debitados das contas com a tag do cartão)
      try {
        const { data: lancamentosComTag } = await supabase
          .from('lancamentos')
          .select('id, tags')
          .eq('user_id', uid)
          .not('tags', 'is', null)

        if (lancamentosComTag && lancamentosComTag.length > 0) {
          const prefixoTag = `fatura:${id}:`
          const idsPagamentosFatura = lancamentosComTag
            .filter(l => l.tags?.some((t: string) => t.startsWith(prefixoTag)))
            .map(l => l.id)

          if (idsPagamentosFatura.length > 0) {
            await supabase.from('lancamentos').delete().in('id', idsPagamentosFatura).eq('user_id', uid)
          }
        }
      } catch (errTag) {
        console.warn('Aviso ao limpar pagamentos de fatura do cartão:', errTag)
      }

      // 3. Limpa histórico de extratos OFX vinculados se existirem
      try {
        await supabase.from('ofx_transacoes').delete().eq('cartao_id', id).eq('user_id', uid)
        await supabase.from('ofx_importacoes').delete().eq('cartao_id', id).eq('user_id', uid)
      } catch {
        // tabelas opcionais
      }

      // 4. Deleta o cartão de crédito
      const { error } = await supabase.from('cartoes').delete().eq('id', id).eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateDadosFinanceiros(qc, userId)
      qc.invalidateQueries({ queryKey: ['cartoes', userId] })
    },
  })
}


export function useFaturaCartao(cartaoId: string, mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['faturas', userId, cartaoId, mes, ano],
    enabled: !!userId && !!cartaoId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('fatura_cartoes')
        .select('*')
        .eq('user_id', uid)
        .eq('cartao_id', cartaoId)
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * "Limite utilizado" de verdade: soma de TODAS as compras desse cartão cuja fatura
 * ainda não foi paga — a fatura atual (fechada ou não) + qualquer parcela futura já
 * comprometida. Assim que uma fatura é paga, o valor dela some daqui automaticamente
 * (ela deixa de contar "contra" o limite, mesmo que as parcelas futuras continuem).
 */
export function useLimiteUtilizadoCartao(cartao?: Pick<Cartao, 'id' | 'dia_fechamento' | 'dia_vencimento'>) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['limite-utilizado-cartao', userId, cartao?.id],
    enabled: !!userId && !!cartao,
    queryFn: async () => {
      const uid = await requireUserId()
      const cartaoId = cartao!.id

      const [despesasRes, faturasRes] = await Promise.all([
        supabase
          .from('lancamentos')
          .select('valor, data, data_vencimento_parcela')
          .eq('user_id', uid)
          .eq('cartao_id', cartaoId)
          .eq('tipo', 'despesa'),
        supabase
          .from('lancamentos')
          .select('tags')
          .eq('user_id', uid)
          .not('tags', 'is', null),
      ])
      if (despesasRes.error) throw despesasRes.error
      if (faturasRes.error) throw faturasRes.error

      // Todas as tags de fatura já paga desse cartão específico (ex.: "fatura:cartaoId:2026:7")
      const prefixoTag = `fatura:${cartaoId}:`
      const faturasPagas = new Set<string>()
      for (const row of faturasRes.data as { tags: string[] | null }[]) {
        for (const tag of row.tags ?? []) {
          if (tag.startsWith(prefixoTag)) faturasPagas.add(tag)
        }
      }

      let total = 0
      for (const d of despesasRes.data as { valor: number; data: string; data_vencimento_parcela: string | null }[]) {
        const dataRef = d.data_vencimento_parcela || d.data
        const [anoStr, mesStr] = dataRef.split('-')
        const ano = Number(anoStr)
        const mes = Number(mesStr)
        const tag = tagPagamentoFatura(cartaoId, mes, ano)
        if (!faturasPagas.has(tag)) total += d.valor
      }
      return total
    },
  })
}

export function useLancamentosCartao(cartaoId: string, mes: number, ano: number) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['lancamentos-cartao', userId, cartaoId, mes, ano],
    enabled: !!cartaoId,
    queryFn: async () => {
      const uid = await requireUserId()
      const inicio = primeiroDiaMes(mes, ano)
      const fim = ultimoDiaMes(mes, ano)

      // Busca lançamentos do cartão cujo vencimento da parcela cai no mês/ano
      // selecionado. Para lançamentos sem data_vencimento_parcela (legados),
      // faz fallback para a data da compra.
      const { data, error } = await supabase
        .from('lancamentos')
        .select(`*, categoria:categorias!categoria_id(id, nome, cor, icone)`)
        .eq('user_id', uid)
        .eq('cartao_id', cartaoId)
        .eq('tipo', 'despesa')
        .or(
          `data_vencimento_parcela.gte.${inicio},data_vencimento_parcela.is.null`
        )
        .order('data', { ascending: false })
      if (error) throw error

      // Filtra no cliente para garantir precisão no intervalo
      const lancamentos = (data as Lancamento[]).filter(l => {
        const dataRef = l.data_vencimento_parcela || l.data
        return dataRef >= inicio && dataRef <= fim
      })

      return lancamentos
    },
  })
}

// ── PERFIL ─────────────────────────────────────────────────
export function usePerfil() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['perfil', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase.from('perfis').select('*').eq('user_id', uid).maybeSingle()
      if (error) throw error
      return data as Perfil | null
    },
  })
}

export function useAtualizarPerfil() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async (updates: Partial<Perfil>) => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('perfis')
        .upsert({ user_id: uid, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data as Perfil
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['perfil', userId] }),
  })
}

// ── NOTIFICAÇÕES ───────────────────────────────────────────
export function useNotificacoes() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['notificacoes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as Notificacao[]
    },
  })
}

// ── INSIGHTS ───────────────────────────────────────────────
export function useInsights() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['insights', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Insight[]
    },
  })
}

// ── BUSCA GLOBAL ───────────────────────────────────────────
export function useBuscaLancamentos(
  termo: string,
  filtro: 'todos' | 'receita' | 'despesa' | 'transferencia' = 'todos',
) {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['busca', userId, termo, filtro],
    enabled: !!userId && termo.length >= 2,
    queryFn: async () => {
      const uid = await requireUserId()
      let query = supabase
        .from('lancamentos')
        .select(`*, categoria:categorias(nome), cartao:cartoes(nome)`)
        .eq('user_id', uid)
        .ilike('descricao', `%${termo}%`)
        .order('data', { ascending: false })
        .limit(30)

      if (filtro !== 'todos') {
        query = query.eq('tipo', filtro)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Lancamento[]
    },
  })
}

// ── EVOLUÇÃO MENSAL ────────────────────────────────────────
export function useEvolucaoMensal() {
  const userId = useStore(s => s.userId)
  return useQuery({
    queryKey: ['evolucao-mensal', userId],
    enabled: !!userId,
    queryFn: async () => {
      const uid = await requireUserId()
      const hoje = new Date()
      // uma folga extra: compra no fim do mês pode "empurrar" a fatura pro mês seguinte
      const { ano: anoBase, mes: mesBase } = subtrairMeses(hoje.getFullYear(), hoje.getMonth() + 1, 6)
      const startOfPeriod = `${anoBase}-${String(mesBase).padStart(2, '0')}-01`

      const { data, error } = await supabase
        .from('lancamentos')
        .select('tipo, valor, data, cartao_id, tags, data_vencimento_parcela, cartao:cartoes!cartao_id(dia_fechamento, dia_vencimento)')
        .eq('user_id', uid)
        .gte('data', startOfPeriod)
        .order('data', { ascending: true })

      if (error) throw error
      const bruto = data as unknown as {
        tipo: 'receita' | 'despesa' | 'transferencia'
        valor: number
        data: string
        cartao_id: string | null
        tags: string[] | null
        data_vencimento_parcela: string | null
        cartao: { dia_fechamento: number; dia_vencimento: number } | null
      }[]

      // Pagamento de fatura não conta aqui: a compra em si já representa o gasto,
      // e já foi (ou será) atribuída ao mês certo da fatura logo abaixo.
      return bruto
        .filter(l => !isPagamentoFatura(l.tags))
        .map(l => {
          const efetivo = mesEfetivo(l, l.cartao?.dia_fechamento, l.cartao?.dia_vencimento)
          return { tipo: l.tipo, valor: l.valor, mes: `${efetivo.ano}-${String(efetivo.mes).padStart(2, '0')}` }
        })
    },
  })
}

export function useLimparTodosLancamentos() {
  const qc = useQueryClient()
  const userId = useStore(s => s.userId)
  return useMutation({
    mutationFn: async () => {
      const uid = await requireUserId()
      const { error } = await supabase.from('lancamentos').delete().eq('user_id', uid)
      if (error) throw error
    },
    onSuccess: () => invalidateDadosFinanceiros(qc, userId),
  })
}


