-- ============================================================================
-- Zenoa Agency — ajoute un SCRIPT (le message de DM) à chaque stratégie du Suivi quotidien.
-- SQL Editor > New query > coller > Run. Relançable sans risque, n'efface rien.
-- ============================================================================
alter table public.suivi_strategies add column if not exists script text check (char_length(script) <= 4000);
notify pgrst, 'reload schema';
