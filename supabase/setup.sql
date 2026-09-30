-- Holdfast: one-time Supabase setup.
-- Paste this whole file into Supabase > SQL Editor > New query, then click Run.
-- Safe to run more than once.

-- 1. Where each account's log records live. One row per record; newest edit wins.
create table if not exists public.docs (
  user_id        uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  path           text        not null,
  data           jsonb,
  deleted        boolean     not null default false,
  updated_at     bigint      not null,               -- when the edit was made on the device (ms)
  server_updated timestamptz not null default now(),  -- when the server received it (used to fetch changes)
  primary key (user_id, path)
);
create index if not exists docs_user_server_updated on public.docs (user_id, server_updated);

-- Keep the newest edit if an older one arrives late, and stamp the server time on every change.
create or replace function public.docs_keep_newest() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated := now();
  return new;
end $$;
drop trigger if exists docs_keep_newest on public.docs;
create trigger docs_keep_newest before insert or update on public.docs
  for each row execute function public.docs_keep_newest();

-- 2. Each account can only see and change its own rows.
alter table public.docs enable row level security;
drop policy if exists "own rows read"   on public.docs;
drop policy if exists "own rows insert" on public.docs;
drop policy if exists "own rows update" on public.docs;
drop policy if exists "own rows delete" on public.docs;
create policy "own rows read"   on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows delete" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Private photo storage. Each account's photos sit in a folder named after its user id.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;
drop policy if exists "own photos read"   on storage.objects;
drop policy if exists "own photos insert" on storage.objects;
drop policy if exists "own photos update" on storage.objects;
drop policy if exists "own photos delete" on storage.objects;
create policy "own photos read"   on storage.objects for select to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos insert" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos update" on storage.objects for update to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own photos delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
