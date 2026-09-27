// ZENOA — Supabase Edge Function
// Déclenchée par un Database Webhook (INSERT sur public.boxmails).
// Envoie une notification push web à chaque abonnement du destinataire.
//
// Déploiement : voir push-notifications.sql pour la table, et le message
// de livraison de la tâche pour les commandes de déploiement complètes.
//
// Secrets requis (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement
// par la plateforme Supabase à toutes les Edge Functions.)

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

    if (!record || !record.recipient_id || !record.sender_id) {
      return new Response("ignored: payload missing record", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [subsRes, senderRes] = await Promise.all([
      supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", record.recipient_id),
      supabase.from("profiles").select("pseudo").eq("id", record.sender_id).single()
    ]);

    const subs = subsRes.data || [];
    if (!subs.length) {
      return new Response("no subscription for recipient", { status: 200 });
    }

    const senderName = (senderRes.data && senderRes.data.pseudo) || "Quelqu'un";
    const body = record.contract_id
      ? "Nouveau contrat de " + senderName
      : "Nouveau message de " + senderName;

    const notifPayload = JSON.stringify({
      title: "ZENOA — Nouveau BoxMail",
      body: body,
      url: "/"
    });

    await Promise.all(subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
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
          console.error("[send-boxmail-push] échec d'envoi:", err);
        }
      }
    }));

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[send-boxmail-push] erreur:", e);
    return new Response("error: " + (e as Error).message, { status: 500 });
  }
});
