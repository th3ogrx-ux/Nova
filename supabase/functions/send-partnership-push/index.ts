// ZENOA — Supabase Edge Function
// Déclenchée par un Database Webhook (INSERT sur public.partnership_leads).
// Envoie une notification push web à chaque abonnement de chaque chef.
//
// Déploiement : voir push-notifications.sql pour la table
// push_subscriptions. Créer le webhook dans Supabase Dashboard >
// Database > Webhooks : table "partnership_leads", événement INSERT,
// type "Edge Function", fonction "send-partnership-push".
//
// Secrets requis (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (déjà configurés pour send-boxmail-push — partagés par toutes les
// Edge Functions du projet, rien à reconfigurer.)

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:contact@zenoa.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload && payload.record;

    if (!record) {
      return new Response("ignored: payload missing record", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const chefsRes = await supabase.from("profiles").select("id").eq("role", "chef");
    const chefIds = ((chefsRes.data as { id: string }[]) || []).map((p) => p.id);
    if (!chefIds.length) {
      return new Response("no chef", { status: 200 });
    }

    const subsRes = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").in("user_id", chefIds);
    const subs = (subsRes.data as { id: string; endpoint: string; p256dh: string; auth: string }[]) || [];
    if (!subs.length) {
      return new Response("no subscription for chef", { status: 200 });
    }

    const label = record.activite || record.email || "sans titre";
    const notifPayload = JSON.stringify({
      title: "ZENOA — Formulaire Partenariat",
      body: "Nouvelle réponse : " + label,
      url: "/"
    });

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notifPayload
        );
      } catch (err) {
        const statusCode = err && (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Abonnement expiré ou révoqué côté navigateur : on le supprime.
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[send-partnership-push] échec d'envoi:", err);
        }
      }
    }));

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[send-partnership-push] erreur:", e);
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
