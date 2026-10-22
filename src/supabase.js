// Client Supabase partagé par toute l'application.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// En prod (Vercel), ces variables doivent être définies dans
// Project Settings > Environment Variables, sinon Vite les inline à
// "undefined" au build. createClient() avec une URL manquante lève
// une exception IMMÉDIATE (pas une erreur réseau) : comme ce fichier
// est importé en tout premier par main.js, ça faisait planter tout le
// script avant même d'afficher quoi que ce soit — d'où l'écran
// totalement noir (fond noir par défaut, rien par-dessus puisque le
// JS n'allait jamais plus loin). On ne laisse plus jamais ça planter :
// on retombe sur une URL factice (les appels échoueront proprement,
// avec un message d'erreur visible, au lieu de tout bloquer au
// chargement) et on expose `supabaseConfigured` pour que main.js
// puisse afficher un message clair.
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error("[Zenoa Agency] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes — vérifie les variables d'environnement sur Vercel (puis redéploie : elles sont lues au moment du build).");
}

export const supabase = createClient(
  url || "https://configuration-manquante.invalid",
  anonKey || "configuration-manquante"
);
