// Client Supabase partagé par toute l'application.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // En prod (Vercel), ces variables doivent être définies dans
  // Project Settings > Environment Variables, sinon Vite les inline
  // à "undefined" au build et le client ne peut pas se connecter.
  console.error("[Zenoa Radar] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes.");
}

export const supabase = createClient(url, anonKey);
