-- ============================================================
-- MULTI-TENANT: cada usuário vê só seus dados
-- Execute no Supabase → SQL Editor (após schema.sql)
-- ============================================================

-- Políticas RLS com WITH CHECK (impede inserir dados de outro usuário)
DROP POLICY IF EXISTS "contas_own" ON contas;
DROP POLICY IF EXISTS "categorias_own" ON categorias;
DROP POLICY IF EXISTS "cartoes_own" ON cartoes;
DROP POLICY IF EXISTS "lancamentos_own" ON lancamentos;
DROP POLICY IF EXISTS "metas_own" ON metas;
DROP POLICY IF EXISTS "orcamentos_own" ON orcamentos;

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

-- Views recriadas com security_invoker (respeitam RLS do usuário logado)
DROP VIEW IF EXISTS fatura_cartoes;
DROP VIEW IF EXISTS resumo_categorias;
DROP VIEW IF EXISTS saldo_contas;

CREATE VIEW saldo_contas
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

CREATE VIEW resumo_categorias
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

CREATE VIEW fatura_cartoes
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

GRANT SELECT ON saldo_contas TO authenticated;
GRANT SELECT ON resumo_categorias TO authenticated;
GRANT SELECT ON fatura_cartoes TO authenticated;
