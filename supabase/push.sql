-- Listo – powiadomienia push (przypomnienia przy zamkniętej aplikacji).
-- Wklej całość w Supabase: SQL Editor → New query → Run (raz, PO wdrożeniu funkcji listo-push).

-- 1) urządzenia zapisane do powiadomień (każdy widzi tylko swoje)
create table if not exists public.listo_push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  ua         text,
  created_at timestamptz not null default now()
);
alter table public.listo_push_subs enable row level security;
grant select, insert, update, delete on table public.listo_push_subs to authenticated;
revoke all on table public.listo_push_subs from anon;
drop policy if exists "listo push: własne urządzenia" on public.listo_push_subs;
create policy "listo push: własne urządzenia" on public.listo_push_subs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) zaplanowane przypomnienia (aplikacja sama je aktualizuje po każdej zmianie zadań)
create table if not exists public.listo_reminders (
  id       text primary key,
  tag      text,
  user_id  uuid not null references auth.users (id) on delete cascade,
  task_id  text,
  fire_at  timestamptz not null,
  title    text not null,
  body     text,
  url      text,
  sent     boolean not null default false
);
create index if not exists listo_reminders_due on public.listo_reminders (sent, fire_at);
alter table public.listo_reminders enable row level security;
grant select, insert, update, delete on table public.listo_reminders to authenticated;
revoke all on table public.listo_reminders from anon;
drop policy if exists "listo push: własne przypomnienia" on public.listo_reminders;
create policy "listo push: własne przypomnienia" on public.listo_reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) konfiguracja serwera (klucze VAPID + tajny klucz harmonogramu) – tylko dla serwera
create table if not exists public.listo_push_config (
  id          int primary key default 1,
  public_key  text,
  private_key text,
  cron_secret text not null
);
alter table public.listo_push_config enable row level security;
revoke all on table public.listo_push_config from anon, authenticated;
insert into public.listo_push_config (id, cron_secret)
values (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (id) do nothing;

-- 4) harmonogram: co minutę wywołaj funkcję listo-push
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'listo-push';
select cron.schedule('listo-push', '* * * * *', $$
  select net.http_post(
    url := 'https://rymgdbonnfrzlsyfdsgb.supabase.co/functions/v1/listo-push',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-listo-cron', (select cron_secret from public.listo_push_config where id = 1)),
    body := '{}'::jsonb
  );
$$);
