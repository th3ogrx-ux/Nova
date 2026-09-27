-- ZENOA — planifie le tirage quotidien de Zenoa Radar (20 prospects/jour).
-- À exécuter UNE SEULE FOIS dans l'éditeur SQL de Supabase, après avoir
-- déployé la fonction "radar-daily" et configuré ses secrets
-- (GEOAPIFY_API_KEY, RADAR_CRON_SECRET).
--
-- Remplace RADAR_CRON_SECRET_ICI par la même valeur que celle que tu as
-- mise dans les secrets de la fonction (Edge Functions -> Secrets).
--
-- Note : pg_cron programme toujours en heure UTC. 10h UTC = midi à Paris
-- en heure d'été (la majorité de l'année) ; en hiver ça tombera à 13h.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'zenoa-radar-daily',
  '0 10 * * *',
  $$
  select net.http_post(
    url := 'https://mfdqxzccmzumxiichdqw.supabase.co/functions/v1/radar-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'RADAR_CRON_SECRET_ICI'),
    body := '{}'::jsonb
  );
  $$
);

-- Pour vérifier que la tâche est bien programmée :
-- select * from cron.job;

-- Pour la supprimer un jour si besoin :
-- select cron.unschedule('zenoa-radar-daily');
