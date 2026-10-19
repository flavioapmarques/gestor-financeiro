/** Dados mock para protótipo / telas em desenvolvimento */
export const mockUser = {
  nome: 'Maria Silva',
  email: 'maria@email.com',
  cpf: '***.***.***-**',
  avatar: null as string | null,
}

export const mockCartoes = [
  { id: '1', nome: 'Nubank Ultravioleta', banco: 'Nubank', bandeira: 'mastercard', limite: 15000, usado: 4230, cor: '#820AD1', fechamento: 3, vencimento: 10 },
  { id: '2', nome: 'Inter Gold', banco: 'Inter', bandeira: 'visa', limite: 8000, usado: 1890, cor: '#FF7A00', fechamento: 15, vencimento: 22 },
  { id: '3', nome: 'C6 Carbon', banco: 'C6 Bank', bandeira: 'mastercard', limite: 25000, usado: 11200, cor: '#1A1F36', fechamento: 1, vencimento: 8 },
]

export const mockCategorias = [
  { id: '1', nome: 'Alimentação', icone: '🍽️', cor: '#FF6B6B', gasto: 1240 },
  { id: '2', nome: 'Mercado', icone: '🛒', cor: '#00C48C', gasto: 890 },
  { id: '3', nome: 'Transporte', icone: '🚗', cor: '#3D5AFE', gasto: 420 },
  { id: '4', nome: 'Saúde', icone: '💊', cor: '#9D4EDD', gasto: 310 },
  { id: '5', nome: 'Lazer', icone: '🎬', cor: '#FFB020', gasto: 580 },
  { id: '6', nome: 'Assinaturas', icone: '📱', cor: '#6B7280', gasto: 199 },
]

export const mockTransacoes = [
  { id: '1', descricao: 'iFood', valor: 45.9, data: '2026-05-20', categoria: 'Alimentação', cartao: 'Nubank', parcelas: null },
  { id: '2', descricao: 'Uber', valor: 28.5, data: '2026-05-19', categoria: 'Transporte', cartao: 'Nubank', parcelas: null },
  { id: '3', descricao: 'Amazon', valor: 189.9, data: '2026-05-18', categoria: 'Lazer', cartao: 'Inter', parcelas: '3/10' },
  { id: '4', descricao: 'Salário', valor: 8500, data: '2026-05-05', categoria: 'Receita', cartao: null, parcelas: null, tipo: 'receita' as const },
]

export const mockMetas = [
  { id: '1', nome: 'Viagem Europa', alvo: 15000, atual: 8200, prazo: '2026-12', cor: '#9D4EDD' },
  { id: '2', nome: 'Reserva emergência', alvo: 10000, atual: 10000, prazo: '2026-06', cor: '#00C48C', concluida: true },
  { id: '3', nome: 'Novo notebook', alvo: 6000, atual: 2100, prazo: '2026-09', cor: '#3D5AFE' },
]

export const mockNotificacoes = [
  { id: '1', tipo: 'compra', titulo: 'Compra aprovada', msg: 'R$ 45,90 no iFood — Nubank', hora: '14:32', lida: false },
  { id: '2', tipo: 'fatura', titulo: 'Fatura próxima', msg: 'Vence em 3 dias — R$ 4.230,00', hora: '09:00', lida: false },
  { id: '3', tipo: 'limite', titulo: 'Limite em 70%', msg: 'Cartão C6 Carbon', hora: 'Ontem', lida: true },
  { id: '4', tipo: 'meta', titulo: 'Meta alcançada! 🎉', msg: 'Reserva de emergência completa', hora: '2 dias', lida: true },
]

export const mockInsights = [
  { id: '1', titulo: 'Gasto acima da média', desc: 'Alimentação 23% acima do mês passado', tipo: 'alerta' as const },
  { id: '2', titulo: 'Economia sugerida', desc: 'Cancele 2 assinaturas não usadas — ~R$ 89/mês', tipo: 'dica' as const },
  { id: '3', titulo: 'Previsão de fatura', desc: 'Nubank: ~R$ 4.800 até o fechamento', tipo: 'previsao' as const },
  { id: '4', titulo: 'Saúde financeira', desc: 'Score 78/100 — bom controle de gastos', tipo: 'saude' as const },
]

export const mockResumo = {
  saldoTotal: 12450.32,
  receitasMes: 8500,
  despesasMes: 5230.45,
  limiteDisponivel: 23780,
  proximaFatura: { cartao: 'Nubank', valor: 4230, vencimento: '10/06' },
}

export const onboardingSlides = [
  { titulo: 'Controle total', desc: 'Organize receitas, despesas e saldo em um só lugar.', icon: '💰' },
  { titulo: 'Cartões inteligentes', desc: 'Faturas, limites e parcelas sempre sob controle.', icon: '💳' },
  { titulo: 'Metas que motivam', desc: 'Defina objetivos e acompanhe seu progresso.', icon: '🎯' },
  { titulo: 'Relatórios claros', desc: 'Gráficos e insights para decidir melhor.', icon: '📊' },
  { titulo: 'Segurança', desc: 'Seus dados protegidos com criptografia.', icon: '🔒' },
]
