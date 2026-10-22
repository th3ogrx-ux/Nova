// Crée TON compte admin (une seule fois).
// Usage :  npm run create-admin -- ton@email.fr "ton-mot-de-passe-solide"
// Utilise la clé secrète du fichier .env.local : ne s'exécute que sur ton ordinateur.
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage : npm run create-admin -- ton@email.fr "mot-de-passe"');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Choisis un mot de passe d'au moins 10 caractères.");
  process.exit(1);
}
const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
if (!url || !key) {
  console.error("Remplis d'abord NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error("Création du compte impossible :", error.message);
  process.exit(1);
}
const { error: profileError } = await supabase.from("profiles").insert({ id: data.user.id, role: "admin", business_id: null });
if (profileError) {
  console.error("Compte créé, mais profil admin impossible (as-tu bien collé 0001_init.sql ?) :", profileError.message);
  process.exit(1);
}
console.log(`Admin créé : ${email}. Tu peux te connecter sur /login.`);
