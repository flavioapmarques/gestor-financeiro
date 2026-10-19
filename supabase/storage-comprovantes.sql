-- ─────────────────────────────────────────────────────────────
-- Bucket de Storage para comprovantes de lançamentos
-- Rode este script uma vez no SQL Editor do seu projeto Supabase.
-- Necessário para o botão "Anexar comprovante" funcionar de verdade.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', true)
on conflict (id) do nothing;

-- Cada usuário só pode enviar/ver/apagar arquivos dentro da sua própria pasta
-- (o app salva em `comprovantes/{user_id}/{arquivo}`)

drop policy if exists "comprovantes_insert_own" on storage.objects;
create policy "comprovantes_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprovantes_select_own" on storage.objects;
create policy "comprovantes_select_own"
  on storage.objects for select
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprovantes_delete_own" on storage.objects;
create policy "comprovantes_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
