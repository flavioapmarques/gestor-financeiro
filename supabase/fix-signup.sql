-- ============================================================
-- CORREÇÃO: "Database error saving new user"
-- Execute no Supabase → SQL Editor → Run
-- ============================================================

-- 1) Remove o trigger que bloqueia o cadastro (se existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.criar_categorias_padrao();

-- 2) Recria a função com permissões corretas para o Auth
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
  -- Não bloqueia o cadastro; o app cria categorias no primeiro login
  RAISE WARNING 'criar_categorias_padrao: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 3) Permissões exigidas pelo Supabase Auth ao executar o trigger
GRANT EXECUTE ON FUNCTION public.criar_categorias_padrao() TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.criar_categorias_padrao() TO service_role;

-- 4) Recria o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_categorias_padrao();

-- ============================================================
-- Se ainda falhar: confirme que schema.sql foi executado antes
-- (tabela public.categorias precisa existir).
-- ============================================================
