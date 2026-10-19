-- ============================================================
-- GESTOR FINANCEIRO — Setup completo no Supabase
-- Cole no SQL Editor e execute (Run / Ctrl+Enter)
--
-- Ordem sugerida se for instalação nova:
--   1) Este arquivo (setup-completo.sql)
--   2) Se cadastro falhar: fix-signup.sql
--   3) Se dados de outro usuário aparecerem: multi-tenant.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABELAS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente','poupanca','carteira','investimento','outro')),
  banco TEXT,
  saldo_inicial NUMERIC(12,2) DEFAULT 0,
  cor TEXT DEFAULT '#820AD1',
  icone TEXT DEFAULT 'bank',
  ativa BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','ambos')),
  cor TEXT DEFAULT '#820AD1',
  icone TEXT DEFAULT 'tag',
  parent_id UUID REFERENCES categorias(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT categorias_pai_mesmo_usuario CHECK (parent_id IS NULL OR parent_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS cartoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  banco TEXT,
  bandeira TEXT DEFAULT 'visa' CHECK (bandeira IN ('visa','mastercard','elo','amex','hipercard','outro')),
  limite NUMERIC(12,2) DEFAULT 0,
  dia_fechamento INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor TEXT DEFAULT '#820AD1',
  conta_pagamento_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  parcelado BOOLEAN DEFAULT FALSE,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  grupo_parcela_id UUID,
  recorrente BOOLEAN DEFAULT FALSE,
  frequencia TEXT CHECK (frequencia IN ('diario','semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual')),
  recorrencia_pai_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL,
  observacao TEXT,
  local_compra TEXT,
  tags TEXT[],
  comprovante_url TEXT,
  efetivado BOOLEAN DEFAULT TRUE,
  conta_destino_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_alvo NUMERIC(12,2) NOT NULL,
  valor_atual NUMERIC(12,2) DEFAULT 0,
  prazo DATE,
  cor TEXT DEFAULT '#00C48C',
  icone TEXT DEFAULT 'target',
  conta_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  concluida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE CASCADE NOT NULL,
  valor_limite NUMERIC(12,2) NOT NULL,
  mes INTEGER CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfil do usuário (dados além do auth)
CREATE TABLE IF NOT EXISTS perfis (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  cpf TEXT,
  avatar_url TEXT,
  tema TEXT DEFAULT 'dark' CHECK (tema IN ('dark','light')),
  idioma TEXT DEFAULT 'pt-BR',
  moeda TEXT DEFAULT 'BRL',
  premium_ate TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações / alertas
CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('compra','fatura','limite','meta','sistema','insight')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  referencia_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights financeiros (sugestões salvas)
CREATE TABLE IF NOT EXISTS insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('alerta','dica','previsao','saude')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas extras em tabelas já existentes
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS local_compra TEXT;
ALTER TABLE cartoes ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categorias(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS idx_categorias_user_parent ON categorias(user_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_categorias_user ON categorias(user_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_user_data ON lancamentos(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_cartao ON lancamentos(cartao_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_lancamentos_busca ON lancamentos(user_id, descricao);

-- ── Validação: subcategoria só pode ter categoria PAI (sem parent) ──
CREATE OR REPLACE FUNCTION public.validar_categoria_hierarquia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.categorias
      WHERE id = NEW.parent_id
        AND user_id = NEW.user_id
        AND parent_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Subcategoria deve apontar para uma categoria principal do mesmo usuário';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Categoria não pode ser pai de si mesma';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categoria_hierarquia ON categorias;
CREATE TRIGGER trg_categoria_hierarquia
  BEFORE INSERT OR UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION public.validar_categoria_hierarquia();

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_own" ON contas;
DROP POLICY IF EXISTS "categorias_own" ON categorias;
DROP POLICY IF EXISTS "cartoes_own" ON cartoes;
DROP POLICY IF EXISTS "lancamentos_own" ON lancamentos;
DROP POLICY IF EXISTS "metas_own" ON metas;
DROP POLICY IF EXISTS "orcamentos_own" ON orcamentos;
DROP POLICY IF EXISTS "perfis_own" ON perfis;
DROP POLICY IF EXISTS "notificacoes_own" ON notificacoes;
DROP POLICY IF EXISTS "insights_own" ON insights;

CREATE POLICY "contas_own" ON contas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categorias_own" ON categorias FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cartoes_own" ON cartoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lancamentos_own" ON lancamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_own" ON metas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orcamentos_own" ON orcamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfis_own" ON perfis FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notificacoes_own" ON notificacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insights_own" ON insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── VIEWS ──────────────────────────────────────────────────
DROP VIEW IF EXISTS fatura_cartoes;
DROP VIEW IF EXISTS resumo_categorias;
DROP VIEW IF EXISTS saldo_contas;

CREATE VIEW saldo_contas WITH (security_invoker = true) AS
SELECT
  c.id, c.user_id, c.nome, c.tipo, c.banco, c.cor, c.saldo_inicial, c.ativa, c.icone,
  c.saldo_inicial + COALESCE(SUM(
    CASE
      WHEN l.tipo = 'receita' THEN l.valor
      WHEN l.tipo = 'despesa' THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.conta_id = c.id THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.conta_destino_id = c.id THEN l.valor
      ELSE 0
    END
  ) FILTER (WHERE l.efetivado = TRUE), 0) AS saldo_atual
FROM contas c
LEFT JOIN lancamentos l ON (l.conta_id = c.id OR l.conta_destino_id = c.id) AND l.user_id = c.user_id
GROUP BY c.id;

CREATE VIEW resumo_categorias WITH (security_invoker = true) AS
SELECT
  l.user_id, l.categoria_id,
  cat.nome AS categoria_nome, cat.cor AS categoria_cor, cat.icone AS categoria_icone,
  cat.parent_id AS categoria_parent_id,
  l.tipo,
  EXTRACT(YEAR FROM l.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM l.data)::INTEGER AS mes,
  COUNT(*) AS qtd_lancamentos,
  SUM(l.valor) AS total
FROM lancamentos l
LEFT JOIN categorias cat ON cat.id = l.categoria_id AND cat.user_id = l.user_id
WHERE l.efetivado = TRUE
GROUP BY l.user_id, l.categoria_id, cat.nome, cat.cor, cat.icone, cat.parent_id, l.tipo, ano, mes;

CREATE VIEW fatura_cartoes WITH (security_invoker = true) AS
SELECT
  l.cartao_id, l.user_id,
  EXTRACT(YEAR FROM l.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM l.data)::INTEGER AS mes,
  SUM(l.valor) AS total_fatura,
  COUNT(*) AS qtd_lancamentos
FROM lancamentos l
WHERE l.cartao_id IS NOT NULL AND l.tipo = 'despesa'
GROUP BY l.cartao_id, l.user_id, ano, mes;

GRANT SELECT ON saldo_contas TO authenticated;
GRANT SELECT ON resumo_categorias TO authenticated;
GRANT SELECT ON fatura_cartoes TO authenticated;

-- ── Setup inicial ao cadastrar usuário ─────────────────────
CREATE OR REPLACE FUNCTION public.setup_novo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.contas (user_id, nome, tipo, cor, icone) VALUES
    (NEW.id, 'Carteira principal', 'carteira', '#820AD1', 'wallet');

  INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
    (NEW.id, 'Salário', 'receita', '#00C48C', 'briefcase'),
    (NEW.id, 'Freelance', 'receita', '#3D5AFE', 'code'),
    (NEW.id, 'Investimentos', 'receita', '#FFB020', 'trending-up'),
    (NEW.id, 'Outros (receita)', 'receita', '#9D4EDD', 'plus-circle'),
    (NEW.id, 'Moradia', 'despesa', '#820AD1', 'home'),
    (NEW.id, 'Alimentação', 'despesa', '#FF6B6B', 'shopping-cart'),
    (NEW.id, 'Transporte', 'despesa', '#3D5AFE', 'car'),
    (NEW.id, 'Saúde', 'despesa', '#FF6B7A', 'heart'),
    (NEW.id, 'Educação', 'despesa', '#9D4EDD', 'book'),
    (NEW.id, 'Lazer', 'despesa', '#FFB020', 'device-tv'),
    (NEW.id, 'Assinaturas', 'despesa', '#6B7280', 'refresh'),
    (NEW.id, 'Outros (despesa)', 'despesa', '#5c6278', 'dots-circle');

  -- Subcategorias de exemplo (Alimentação e Transporte)
  INSERT INTO public.categorias (user_id, nome, tipo, cor, icone, parent_id)
  SELECT NEW.id, sub.nome, 'despesa', sub.cor, sub.icone, pai.id
  FROM (VALUES
    ('Restaurante', '#FF6B6B', 'utensils'),
    ('Mercado', '#00C48C', 'shopping-cart'),
    ('Delivery', '#FFB020', 'bike')
  ) AS sub(nome, cor, icone)
  CROSS JOIN LATERAL (
    SELECT id FROM public.categorias WHERE user_id = NEW.id AND nome = 'Alimentação' LIMIT 1
  ) pai;

  INSERT INTO public.categorias (user_id, nome, tipo, cor, icone, parent_id)
  SELECT NEW.id, sub.nome, 'despesa', sub.cor, sub.icone, pai.id
  FROM (VALUES
    ('Combustível', '#3D5AFE', 'fuel'),
    ('Uber/99', '#820AD1', 'car')
  ) AS sub(nome, cor, icone)
  CROSS JOIN LATERAL (
    SELECT id FROM public.categorias WHERE user_id = NEW.id AND nome = 'Transporte' LIMIT 1
  ) pai;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'setup_novo_usuario: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.criar_categorias_padrao();

GRANT EXECUTE ON FUNCTION public.setup_novo_usuario() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.setup_novo_usuario() TO service_role;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.setup_novo_usuario();

-- ── Storage para comprovantes (opcional) ───────────────────
-- No painel: Storage → New bucket → nome: comprovantes → Private
-- Política: usuário autenticado só acessa pasta do próprio user_id

-- ============================================================
-- FIM — Tabelas prontas para o app
-- ============================================================
