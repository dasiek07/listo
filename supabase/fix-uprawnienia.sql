-- Listo – brakujące uprawnienia (uruchom raz w Supabase: SQL Editor → New query → Run).
-- Zalogowani użytkownicy mogą korzystać z tabeli; reguły RLS ograniczają każdego do jego własnych zadań.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.listo_state to authenticated;
revoke all on table public.listo_state from anon;
