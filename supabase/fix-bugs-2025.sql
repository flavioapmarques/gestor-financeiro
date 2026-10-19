-- ============================================================
-- FIX: Bugs de transferência entre bancos e cartão de crédito
-- Execute este script no SQL Editor do Supabase
-- Data: 2025
-- ============================================================

-- ── FIX 1: View fatura_cartoes ────────────────────────────
-- PROBLEMA: A view usava l.data (data da compra) para calcular mês/ano
-- da fatura. Isso colocava lançamentos parcelados ou com vencimento
-- diferente no mês errado.
-- SOLUÇÃO: Usar data_vencimento_parcela quando disponível.

CREATE OR REPLACE VIEW fatura_cartoes
WITH (security_invoker = true)
AS
SELECT
  l.cartao_id,
  l.user_id,
  EXTRACT(YEAR FROM COALESCE(l.data_vencimento_parcela, l.data)::DATE)::INTEGER AS ano,
  EXTRACT(MONTH FROM COALESCE(l.data_vencimento_parcela, l.data)::DATE)::INTEGER AS mes,
  SUM(l.valor) AS total_fatura,
  COUNT(*) AS qtd_lancamentos
FROM lancamentos l
WHERE l.cartao_id IS NOT NULL AND l.tipo = 'despesa'
GROUP BY l.cartao_id, l.user_id, ano, mes;

GRANT SELECT ON fatura_cartoes TO authenticated;

-- ── FIX 2: Verificação da view saldo_bancos ───────────────
-- A view já estava correta para transferências, mas recriamos
-- para garantir que está atualizada:

CREATE OR REPLACE VIEW saldo_bancos
WITH (security_invoker = true)
AS
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
      WHEN l.tipo = 'receita'       AND l.banco_id = b.id                THEN  l.valor
      WHEN l.tipo = 'despesa'       AND l.banco_id = b.id                THEN -l.valor
      WHEN l.tipo = 'transferencia' AND l.banco_id = b.id                THEN -l.valor  -- saída
      WHEN l.tipo = 'transferencia' AND l.banco_destino_id = b.id        THEN  l.valor  -- entrada
      ELSE 0
    END
  ) FILTER (WHERE l.efetivado = TRUE AND l.data >= b.data_saldo_inicial), 0) AS saldo_atual
FROM bancos b
LEFT JOIN lancamentos l
  ON (l.banco_id = b.id OR l.banco_destino_id = b.id)
  AND l.user_id = b.user_id
GROUP BY b.id;

GRANT SELECT ON saldo_bancos TO authenticated;

-- ── RESULTADO ESPERADO ────────────────────────────────────
-- 1. Compras no cartão de crédito aparecem no mês da fatura (vencimento),
--    não no mês da compra.
-- 2. Transferências entre bancos debitam corretamente da conta origem
--    e creditam na conta destino no saldo_bancos.
