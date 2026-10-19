-- ============================================================
-- GESTOR FINANCEIRO — BANCO NOVO (apaga tudo e recria)
--
-- ⚠️ ATENÇÃO: Isso APAGA todas as tabelas públicas do app.
-- Execute só se quiser começar do zero.
--
-- Supabase → SQL Editor → Cole tudo → Run
-- ============================================================

-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── REMOVER OBJETOS ANTIGOS ─────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.setup_novo_usuario() CASCADE;
DROP FUNCTION IF EXISTS public.criar_categorias_padrao() CASCADE;
DROP FUNCTION IF EXISTS public.validar_categoria_hierarquia() CASCADE;

DROP VIEW IF EXISTS fatura_cartoes CASCADE;
DROP VIEW IF EXISTS resumo_categorias CASCADE;
DROP VIEW IF EXISTS saldo_contas CASCADE;
DROP VIEW IF EXISTS saldo_bancos CASCADE;

DROP TABLE IF EXISTS orcamentos CASCADE;
DROP TABLE IF EXISTS lancamentos CASCADE;
DROP TABLE IF EXISTS metas CASCADE;
DROP TABLE IF EXISTS cartoes CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS contas CASCADE;
DROP TABLE IF EXISTS bancos CASCADE;
DROP TABLE IF EXISTS insights CASCADE;
DROP TABLE IF EXISTS notificacoes CASCADE;
DROP TABLE IF EXISTS perfis CASCADE;

-- ============================================================
-- TABELAS
-- ============================================================

-- Perfil do usuário
CREATE TABLE perfis (
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

-- BANCOS (contas bancárias do usuário)
CREATE TABLE bancos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,                    -- Ex: "Conta corrente"
  instituicao TEXT NOT NULL,             -- Ex: "Nubank", "Bradesco"
  tipo TEXT NOT NULL DEFAULT 'corrente'
    CHECK (tipo IN ('corrente','poupanca','carteira','investimento','outro')),
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_saldo_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
  agencia TEXT,
  numero_conta TEXT,
  cor TEXT DEFAULT '#820AD1',
  icone TEXT DEFAULT 'landmark',
  ativo BOOLEAN DEFAULT TRUE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias (parent_id = subcategoria)
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','ambos')),
  cor TEXT DEFAULT '#820AD1',
  icone TEXT DEFAULT 'tag',
  parent_id UUID REFERENCES categorias(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de crédito
CREATE TABLE cartoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  bandeira TEXT DEFAULT 'visa'
    CHECK (bandeira IN ('visa','mastercard','elo','amex','hipercard','outro')),
  limite NUMERIC(14,2) NOT NULL DEFAULT 0,
  dia_fechamento INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor TEXT DEFAULT '#820AD1',
  banco_pagamento_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lançamentos (receitas, despesas, transferências)
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','transferencia')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data DATE NOT NULL,
  categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
  banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  parcelado BOOLEAN DEFAULT FALSE,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  grupo_parcela_id UUID,
  recorrente BOOLEAN DEFAULT FALSE,
  frequencia TEXT CHECK (frequencia IN (
    'diario','semanal','quinzenal','mensal','bimestral','trimestral','semestral','anual'
  )),
  recorrencia_pai_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL,
  observacao TEXT,
  local_compra TEXT,
  tags TEXT[],
  comprovante_url TEXT,
  efetivado BOOLEAN DEFAULT TRUE,
  banco_destino_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metas financeiras
CREATE TABLE metas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_alvo NUMERIC(14,2) NOT NULL,
  valor_atual NUMERIC(14,2) DEFAULT 0,
  prazo DATE,
  cor TEXT DEFAULT '#00C48C',
  icone TEXT DEFAULT 'target',
  banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  concluida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orçamentos por categoria
CREATE TABLE orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  valor_limite NUMERIC(14,2) NOT NULL,
  mes INTEGER CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notificações
CREATE TABLE notificacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('compra','fatura','limite','meta','sistema','insight')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  referencia_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights
CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('alerta','dica','previsao','saude')),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  lida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VALIDAÇÕES
-- ============================================================

CREATE OR REPLACE FUNCTION public.validar_categoria_hierarquia()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM categorias
      WHERE id = NEW.parent_id AND user_id = NEW.user_id AND parent_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Subcategoria precisa de uma categoria pai válida';
    END IF;
  END IF;
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'Categoria não pode ser pai de si mesma';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_categoria_hierarquia
  BEFORE INSERT OR UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION public.validar_categoria_hierarquia();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfis_own" ON perfis FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bancos_own" ON bancos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categorias_own" ON categorias FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cartoes_own" ON cartoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lancamentos_own" ON lancamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "metas_own" ON metas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orcamentos_own" ON orcamentos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notificacoes_own" ON notificacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "insights_own" ON insights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- VIEWS
-- ============================================================

-- Saldo atual = saldo_inicial na data_saldo_inicial + movimentos a partir dessa data
CREATE VIEW saldo_bancos WITH (security_invoker = true) AS
SELECT
  b.id,
  b.user_id,
  b.nome,
  b.instituicao,
  b.tipo,
  b.saldo_inicial,
  b.data_saldo_inicial,
  b.agencia,
  b.numero_conta,
  b.cor,
  b.icone,
  b.ativo,
  b.observacao,
  b.created_at,
  b.updated_at,
  b.saldo_inicial + COALESCE(SUM(
    CASE
      WHEN l.tipo = 'receita' THEN l.valor
      WHEN l.tipo = 'despesa' THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.banco_id = b.id THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.banco_destino_id = b.id THEN l.valor
      ELSE 0
    END
  ) FILTER (WHERE l.efetivado = TRUE AND l.data >= b.data_saldo_inicial), 0) AS saldo_atual
FROM bancos b
LEFT JOIN lancamentos l ON (l.banco_id = b.id OR l.banco_destino_id = b.id) AND l.user_id = b.user_id
GROUP BY b.id;

CREATE VIEW resumo_categorias WITH (security_invoker = true) AS
SELECT
  l.user_id,
  l.categoria_id,
  cat.nome AS categoria_nome,
  cat.cor AS categoria_cor,
  cat.icone AS categoria_icone,
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
  l.cartao_id,
  l.user_id,
  EXTRACT(YEAR FROM l.data)::INTEGER AS ano,
  EXTRACT(MONTH FROM l.data)::INTEGER AS mes,
  SUM(l.valor) AS total_fatura,
  COUNT(*) AS qtd_lancamentos
FROM lancamentos l
WHERE l.cartao_id IS NOT NULL AND l.tipo = 'despesa'
GROUP BY l.cartao_id, l.user_id, ano, mes;

GRANT SELECT ON saldo_bancos TO authenticated;
GRANT SELECT ON resumo_categorias TO authenticated;
GRANT SELECT ON fatura_cartoes TO authenticated;

-- ============================================================
-- SETUP NOVO USUÁRIO (categorias padrão, sem banco — usuário cadastra)
-- ============================================================

CREATE OR REPLACE FUNCTION public.setup_novo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO perfis (user_id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));

  INSERT INTO categorias (user_id, nome, tipo, cor, icone) VALUES
    (NEW.id, 'Salário', 'receita', '#00C48C', 'briefcase'),
    (NEW.id, 'Freelance', 'receita', '#3D5AFE', 'code'),
    (NEW.id, 'Outros (receita)', 'receita', '#9D4EDD', 'plus-circle'),
    (NEW.id, 'Moradia', 'despesa', '#820AD1', 'home'),
    (NEW.id, 'Alimentação', 'despesa', '#FF6B6B', 'shopping-cart'),
    (NEW.id, 'Transporte', 'despesa', '#3D5AFE', 'car'),
    (NEW.id, 'Saúde', 'despesa', '#FF6B7A', 'heart'),
    (NEW.id, 'Lazer', 'despesa', '#FFB020', 'device-tv'),
    (NEW.id, 'Assinaturas', 'despesa', '#6B7280', 'refresh'),
    (NEW.id, 'Outros (despesa)', 'despesa', '#5c6278', 'dots-circle');

  INSERT INTO categorias (user_id, nome, tipo, cor, icone, parent_id)
  SELECT NEW.id, sub.nome, 'despesa', sub.cor, sub.icone, pai.id
  FROM (VALUES
    ('Restaurante', '#FF6B6B', 'utensils'),
    ('Mercado', '#00C48C', 'shopping-cart'),
    ('Delivery', '#FFB020', 'bike')
  ) AS sub(nome, cor, icone)
  CROSS JOIN LATERAL (
    SELECT id FROM categorias WHERE user_id = NEW.id AND nome = 'Alimentação' LIMIT 1
  ) pai;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'setup_novo_usuario: %', SQLERRM;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_novo_usuario() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.setup_novo_usuario() TO service_role;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.setup_novo_usuario();

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_bancos_user ON bancos(user_id);
CREATE INDEX idx_categorias_user_parent ON categorias(user_id, parent_id);
CREATE INDEX idx_lancamentos_user_data ON lancamentos(user_id, data DESC);
CREATE INDEX idx_lancamentos_banco ON lancamentos(banco_id);
CREATE INDEX idx_lancamentos_cartao ON lancamentos(cartao_id);
CREATE INDEX idx_lancamentos_categoria ON lancamentos(categoria_id);

-- ============================================================
-- PRONTO! Cadastre bancos no app em /bancos
-- ============================================================
