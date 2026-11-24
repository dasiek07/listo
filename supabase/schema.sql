-- Listo – baza danych w Supabase.
-- Wklej całość w Supabase: SQL Editor → New query → Run.
-- Każdy użytkownik ma jeden wiersz ze swoimi zadaniami; reguły (RLS) pilnują,
-- żeby nikt nie mógł odczytać ani zmienić cudzych danych.

create table if not exists public.listo_state (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  state     jsonb not null,
  client    text,
  rev       integer not null default 0,
  saved_at  timestamptz not null default now()
);

alter table public.listo_state enable row level security;

-- nowe projekty Supabase nie nadają uprawnień automatycznie: zalogowani mogą działać na tabeli,
-- a reguły poniżej i tak ograniczają ich wyłącznie do własnego wiersza. Niezalogowani – brak dostępu.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.listo_state to authenticated;
revoke all on table public.listo_state from anon;

drop policy if exists "listo: odczyt własnych danych" on public.listo_state;
drop policy if exists "listo: dodanie własnych danych" on public.listo_state;
drop policy if exists "listo: zmiana własnych danych" on public.listo_state;
drop policy if exists "listo: usunięcie własnych danych" on public.listo_state;

create policy "listo: odczyt własnych danych"   on public.listo_state for select using (auth.uid() = user_id);
create policy "listo: dodanie własnych danych"  on public.listo_state for insert with check (auth.uid() = user_id);
create policy "listo: zmiana własnych danych"   on public.listo_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "listo: usunięcie własnych danych" on public.listo_state for delete using (auth.uid() = user_id);

-- powiadomienia na żywo o zmianach (synchronizacja między urządzeniami w kilka sekund)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listo_state') then
    alter publication supabase_realtime add table public.listo_state;
  end if;
end $$;
