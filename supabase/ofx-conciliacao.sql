-- Conciliacao OFX: migracao aditiva para bancos ja existentes.
-- Execute este arquivo no SQL Editor do Supabase antes de usar o historico persistente.

ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS ofx_transacao_id TEXT;

CREATE TABLE IF NOT EXISTS ofx_importacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  arquivo_nome TEXT NOT NULL,
  origem TEXT NOT NULL CHECK (origem IN ('conta', 'cartao', 'desconhecida')),
  importado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_transacoes INTEGER NOT NULL DEFAULT 0,
  total_ja_lancadas INTEGER NOT NULL DEFAULT 0,
  total_possiveis INTEGER NOT NULL DEFAULT 0,
  total_nao_lancadas INTEGER NOT NULL DEFAULT 0,
  total_duplicidades INTEGER NOT NULL DEFAULT 0,
  total_ignoradas INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ofx_transacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  importacao_id UUID NOT NULL REFERENCES ofx_importacoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES cartoes(id) ON DELETE SET NULL,
  fitid TEXT NOT NULL,
  data DATE NOT NULL,
  valor NUMERIC(14,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  descricao TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ja_lancado', 'possivel', 'nao_lancado', 'duplicidade', 'ignorado', 'importado')),
  lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_ofx_id_banco
  ON lancamentos(user_id, banco_id, ofx_transacao_id)
  WHERE ofx_transacao_id IS NOT NULL AND banco_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_ofx_id_cartao
  ON lancamentos(user_id, cartao_id, ofx_transacao_id)
  WHERE ofx_transacao_id IS NOT NULL AND cartao_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ofx_transacoes_importacao_fitid
  ON ofx_transacoes(importacao_id, fitid);
CREATE INDEX IF NOT EXISTS idx_ofx_importacoes_user_data
  ON ofx_importacoes(user_id, importado_em DESC);
CREATE INDEX IF NOT EXISTS idx_ofx_transacoes_user_fitid
  ON ofx_transacoes(user_id, fitid);

ALTER TABLE ofx_importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ofx_transacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ofx_importacoes_own" ON ofx_importacoes;
CREATE POLICY "ofx_importacoes_own" ON ofx_importacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ofx_transacoes_own" ON ofx_transacoes;
CREATE POLICY "ofx_transacoes_own" ON ofx_transacoes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
