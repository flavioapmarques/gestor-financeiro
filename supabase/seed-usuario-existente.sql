-- ============================================================
-- Use se você JÁ tinha conta antes do setup-completo.sql
-- 1) Authentication → Users → copie o UUID do seu usuário
-- 2) Substitua 'SEU_USER_ID_AQUI' abaixo
-- 3) Execute no SQL Editor
-- ============================================================

-- Troque pelo seu UUID:
-- SELECT id, email FROM auth.users;

DO $$
DECLARE
  v_user UUID := 'SEU_USER_ID_AQUI'::UUID;
BEGIN
  IF v_user = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RAISE EXCEPTION 'Substitua SEU_USER_ID_AQUI pelo UUID real do auth.users';
  END IF;

  INSERT INTO public.perfis (user_id, nome) VALUES (v_user, 'Usuário')
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.contas WHERE user_id = v_user) THEN
    INSERT INTO public.contas (user_id, nome, tipo, cor, icone)
    VALUES (v_user, 'Carteira principal', 'carteira', '#820AD1', 'wallet');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.categorias WHERE user_id = v_user) THEN
    INSERT INTO public.categorias (user_id, nome, tipo, cor, icone) VALUES
      (v_user, 'Salário', 'receita', '#00C48C', 'briefcase'),
      (v_user, 'Alimentação', 'despesa', '#FF6B6B', 'shopping-cart'),
      (v_user, 'Transporte', 'despesa', '#3D5AFE', 'car'),
      (v_user, 'Moradia', 'despesa', '#820AD1', 'home'),
      (v_user, 'Lazer', 'despesa', '#FFB020', 'device-tv');
  END IF;
END $$;
