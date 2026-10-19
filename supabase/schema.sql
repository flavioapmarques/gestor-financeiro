-- ============================================================
-- GESTOR FINANCEIRO - Schema Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- ============================================================

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS PRINCIPAIS
-- ============================================================

-- Contas bancárias / carteiras
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente','poupanca','carteira','investimento','outro')),
  banco TEXT,
  saldo_inicial NUMERIC(12,2) DEFAULT 0,
  cor TEXT DEFAULT '#6C8EF5',
  icone TEXT DEFAULT 'bank',
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','ambos')),
  cor TEXT DEFAULT '#6C8EF5',
  icone TEXT DEFAULT 'tag',
  parent_id UUID REFERENCES categorias(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de crédito
CREATE TABLE IF NOT EXISTS cartoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  bandeira TEXT DEFAULT 'visa' CHECK (bandeira IN ('visa','mastercard','elo','amex','hipercard','outro')),
  limite NUMERIC(12,2) DEFAULT 0,
  dia_fechamento INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor TEXT DEFAULT '#6C8EF5',
  conta_pagamento_id UUID REFERENCES contas(id),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lançamentos (transações)
CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  conta_id UUID REFERENCES contas(id),
  cartao_id UUID REFERENCES cartoes(id),
  -- Parcelamento
  parcelado BOOLEAN DEFAULT FALSE,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  grupo_parcela_id UUID,  -- mesmo ID para parcelas do mesmo grupo
  -- Recorrência
  recorrente BOOLEAN DEFAULT FALSE,
  frequencia TEXT CHECK (frequencia IN ('diario','semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  recorrencia_pai_id UUID REFERENCES lancamentos(id),
  -- Extras
  observacao TEXT,
  tags TEXT[],
  comprovante_url TEXT,
  efetivado BOOLEAN DEFAULT TRUE,
  -- Transferência
  conta_destino_id UUID REFERENCES contas(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metas financeiras
CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_alvo NUMERIC(12,2) NOT NULL,
  valor_atual NUMERIC(12,2) DEFAULT 0,
  prazo DATE,
  cor TEXT DEFAULT '#22d4a0',
  icone TEXT DEFAULT 'target',
  conta_id UUID REFERENCES contas(id),
  concluida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orçamentos por categoria/mês
CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) NOT NULL,
  valor_limite NUMERIC(12,2) NOT NULL,
  mes INTEGER CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER,
  -- NULL em mes/ano = orçamento mensal recorrente
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Cada user só vê seus dados
-- ============================================================

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário só acessa o próprio dado (SELECT/INSERT/UPDATE/DELETE)
CREATE POLICY "contas_own" ON contas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categorias_own" ON categorias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cartoes_own" ON cartoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lancamentos_own" ON lancamentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_own" ON metas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orcamentos_own" ON orcamentos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FUNÇÕES / VIEWS ÚTEIS
-- ============================================================

-- Saldo atual de cada conta (security_invoker = respeita RLS por usuário)
CREATE OR REPLACE VIEW saldo_contas
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.user_id,
  c.nome,
  c.tipo,
  c.banco,
  c.cor,
  c.saldo_inicial,
  c.ativa,
  c.saldo_inicial +
    COALESCE(SUM(
      CASE
        WHEN l.tipo = 'receita' THEN l.valor
        WHEN l.tipo = 'despesa' THEN -l.valor
        WHEN l.tipo = 'transferencia' AND l.conta_id = c.id THEN -l.valor
        WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN l.valor
        ELSE 0
      END
    ) FILTER (WHERE l.efetivado = TRUE), 0) AS saldo_atual
FROM contas c
LEFT JOIN lancamentos l ON (l.conta_id = c.id OR l.conta_destino_id = c.id)
  AND l.user_id = c.user_id
GROUP BY c.id;

-- Resumo mensal por categoria
CREATE OR REPLACE VIEW resumo_categorias
WITH (security_invoker = true)
AS
SELECT
  l.user_id,
  l.categoria_id,
  cat.nome AS categoria_nome,
  cat.cor AS categoria_cor,
  cat.icone AS categoria_icone,
  l.tipo,
  EXTRACT(YEAR FROM l.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM l.data)::INTEGER AS mes,
  COUNT(*) AS qtd_lancamentos,
  SUM(l.valor) AS total
FROM lancamentos l
LEFT JOIN categorias cat ON cat.id = l.categoria_id AND cat.user_id = l.user_id
WHERE l.efetivado = TRUE
GROUP BY l.user_id, l.categoria_id, cat.nome, cat.cor, cat.icone, l.tipo, ano, mes;

-- Fatura do cartão por mês
CREATE OR REPLACE VIEW fatura_cartoes
WITH (security_invoker = true)
AS
SELECT
  l.cartao_id,
  l.user_id,
  EXTRACT(YEAR FROM l.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM l.data)::INTEGER AS mes,
  SUM(l.valor) AS total_fatura,
  COUNT(*) AS qtd_lancamentos
FROM lancamentos l
WHERE l.cartao_id IS NOT NULL
GROUP BY l.cartao_id, l.user_id, ano, mes;

-- ============================================================
-- CATEGORIAS PADRÃO (inseridas após o primeiro login via trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.criar_categorias_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
    (NEW.id, 'Salário',         'receita',  '#22d4a0', 'briefcase'),
    (NEW.id, 'Freelance',       'receita',  '#6C8EF5', 'code'),
    (NEW.id, 'Investimentos',   'receita',  '#f5c842', 'trending-up'),
    (NEW.id, 'Outros (receita)','receita',  '#b06ef5', 'plus-circle'),
    (NEW.id, 'Moradia',         'despesa',  '#6C8EF5', 'home'),
    (NEW.id, 'Alimentação',     'despesa',  '#22d4a0', 'shopping-cart'),
    (NEW.id, 'Transporte',      'despesa',  '#f5c842', 'car'),
    (NEW.id, 'Saúde',           'despesa',  '#ff6b7a', 'heart'),
    (NEW.id, 'Educação',        'despesa',  '#b06ef5', 'book'),
    (NEW.id, 'Lazer',           'despesa',  '#ff6b7a', 'device-tv'),
    (NEW.id, 'Vestuário',       'despesa',  '#f5c842', 'shirt'),
    (NEW.id, 'Assinaturas',     'despesa',  '#b06ef5', 'refresh'),
    (NEW.id, 'Outros (despesa)','despesa',  '#5c6278', 'dots-circle');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'criar_categorias_padrao: %', SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_categorias_padrao() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.criar_categorias_padrao() TO service_role;

-- Trigger: cria categorias padrão quando usuário se registra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_categorias_padrao();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_lancamentos_user_data ON lancamentos(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao ON lancamentos(cartao_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_conta ON lancamentos(conta_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo_parcela ON lancamentos(grupo_parcela_id);
