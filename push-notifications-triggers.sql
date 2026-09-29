-- ============================================================
-- ZENOA — Déclencheurs des notifications push (BoxMail + Partenariat)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
--
-- Les Database Webhooks natifs de Supabase n'étaient pas disponibles
-- dans le dashboard de ce projet, donc on appelle les Edge Functions
-- directement via pg_net depuis un trigger Postgres classique.
--
-- Prérequis : les Edge Functions "send-boxmail-push" et
-- "send-partnership-push" doivent être déployées (voir
-- supabase/functions/send-boxmail-push et send-partnership-push),
-- et les secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
-- configurés côté Supabase.
-- ============================================================

create or replace function public.notify_boxmail_push()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://mfdqxzccmzumxiichdqw.supabase.co/functions/v1/send-boxmail-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists boxmail_push_trigger on public.boxmails;
create trigger boxmail_push_trigger
after insert on public.boxmails
for each row execute function public.notify_boxmail_push();

create or replace function public.notify_partnership_push()
returns trigger
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    url := 'https://mfdqxzccmzumxiichdqw.supabase.co/functions/v1/send-partnership-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_Qes5VQ0OcaAEVh_kMjej6A_HJ6yxY3T'
    ),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end;
$$;

drop trigger if exists partnership_push_trigger on public.partnership_leads;
create trigger partnership_push_trigger
after insert on public.partnership_leads
for each row execute function public.notify_partnership_push();
