import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltam variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Types ──────────────────────────────────────────────────
export type TipoConta = 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'outro'
export type TipoLancamento = 'receita' | 'despesa' | 'transferencia'
export type TipoCategoria = 'receita' | 'despesa' | 'ambos'
export type Frequencia = 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export type Bandeira =
  | 'visa'
  | 'mastercard'
  | 'elo'
  | 'amex'
  | 'hipercard'
  | 'diners'
  | 'discover'
  | 'jcb'
  | 'alelo'
  | 'sodexo'
  | 'ticket'
  | 'caju'
  | 'vr'
  | 'outro'


/** Cadastro de banco / conta bancária */
export interface Banco {
  id: string
  user_id: string
  nome: string
  instituicao: string
  tipo: TipoConta
  saldo_inicial: number
  data_saldo_inicial: string
  agencia?: string
  numero_conta?: string
  cor: string
  icone: string
  ativo: boolean
  observacao?: string
  created_at: string
  updated_at: string
  saldo_atual?: number
}

/** @deprecated use Banco */
export type Conta = Banco

export interface Categoria {
  id: string
  user_id: string
  nome: string
  tipo: TipoCategoria
  cor: string
  icone: string
  parent_id?: string
  created_at: string
}

export interface Cartao {
  id: string
  user_id: string
  nome: string
  banco?: string
  bandeira: Bandeira
  limite: number
  dia_fechamento: number
  dia_vencimento: number
  cor: string
  banco_pagamento_id?: string
  ativo: boolean
  created_at: string
  updated_at: string
  // computed
  fatura_atual?: number
}

export interface Lancamento {
  id: string
  user_id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data: string
  categoria_id?: string
  banco_id?: string
  cartao_id?: string
  banco_destino_id?: string
  parcelado: boolean
  parcela_atual?: number
  total_parcelas?: number
  grupo_parcela_id?: string
  recorrente: boolean
  frequencia?: Frequencia
  recorrencia_pai_id?: string
  observacao?: string
  local_compra?: string
  data_vencimento_parcela?: string
  tags?: string[]
  comprovante_url?: string
  efetivado: boolean
  created_at: string
  updated_at: string
  // joins
  categoria?: Categoria
  banco?: Banco
  banco_destino?: Banco
  cartao?: Cartao
}

export interface Meta {
  id: string
  user_id: string
  nome: string
  descricao?: string
  valor_alvo: number
  valor_atual: number
  prazo?: string
  cor: string
  icone: string
  banco_id?: string
  concluida: boolean
  created_at: string
  updated_at: string
}

export interface Perfil {
  user_id: string
  nome?: string
  cpf?: string
  avatar_url?: string
  tema: 'dark' | 'light'
  idioma: string
  moeda: string
  premium_ate?: string
  created_at: string
  updated_at: string
}

export interface Notificacao {
  id: string
  user_id: string
  tipo: 'compra' | 'fatura' | 'limite' | 'meta' | 'sistema' | 'insight'
  titulo: string
  mensagem: string
  lida: boolean
  referencia_id?: string
  created_at: string
}

export interface Insight {
  id: string
  user_id: string
  tipo: 'alerta' | 'dica' | 'previsao' | 'saude'
  titulo: string
  descricao: string
  lida: boolean
  created_at: string
}

export interface CategoriaComFilhos extends Categoria {
  subcategorias?: Categoria[]
}

export interface Orcamento {
  id: string
  user_id: string
  categoria_id: string
  valor_limite: number
  mes?: number
  ano?: number
  created_at: string
  updated_at: string
  // joins
  categoria?: Categoria
  gasto_atual?: number
}
